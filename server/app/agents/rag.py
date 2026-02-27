"""
agents/rag/service.py

ProjectRAG — the main entry point for all RAG operations.

Replaces the original in-memory ProjectRAG class with identical public API:
  - index_file(file_path, content)
  - retrieve(query, top_k) → str
  - get_file_tree() → str

Drop-in replacement: agents call the same methods, get the same output format.
"""
from .embedder import embed_texts, embed_query
from app.repositories.rag_repository import ChunkRepository, create_pool

_CHUNK_SIZE = 50  # lines per chunk — matches original behavior


class ProjectRAG:
    """
    Production RAG backed by Neon Postgres + pgvector.

    Lifecycle (in a Celery worker or FastAPI startup):
        rag = await ProjectRAG.create(project_id, dsn)
        await rag.index_file("main.py", source_code)
        context = await rag.retrieve("how does auth work?")

    The pool is shared across all operations. Call close() on shutdown.
    """

    def __init__(self, project_id: str, repo: ChunkRepository):
        self.project_id = project_id
        self._repo = repo

    @classmethod
    async def create(cls, project_id: str, dsn: str) -> "ProjectRAG":
        """
        Async factory. Creates DB pool, ensures schema, returns ready instance.
        Call this once per project per worker process.
        """
        pool = await create_pool(dsn)
        repo = ChunkRepository(pool)
        await repo.ensure_schema()
        return cls(project_id, repo)

    async def close(self) -> None:
        """Close the connection pool. Call on worker shutdown."""
        await self._repo._pool.close()

    # ── Public API (matches original ProjectRAG exactly) ─────────────────────

    async def index_file(self, file_path: str, content: str) -> None:
        """
        Index a file into the vector store.

        Steps:
          1. Delete any existing chunks for this file (handles re-indexing)
          2. Split content into ~50-line chunks
          3. Batch-generate embeddings for all chunks at once
          4. Batch-insert into DB

        This is async-safe: each Celery task gets its own pool connection.
        """
        chunks = _split_into_chunks(file_path, content, _CHUNK_SIZE)
        if not chunks:
            return

        # Step 1: clear stale chunks for this file
        await self._repo.delete_file_chunks(self.project_id, file_path)

        # Step 2: batch embed all chunks in one model call
        texts = [c["content"] for c in chunks]
        embeddings = embed_texts(texts)  # list[list[float]], same order as texts

        # Step 3: attach embeddings to chunk dicts
        for chunk, embedding in zip(chunks, embeddings):
            chunk["embedding"] = embedding

        # Step 4: batch insert
        await self._repo.insert_chunks(self.project_id, file_path, chunks)

    async def retrieve(self, query: str, top_k: int = 5) -> str:
        """
        Retrieve top-k relevant code chunks for a query.
        Returns formatted context string identical to the original implementation.
        """
        # Embed query (single vector)
        query_vec = embed_query(query)

        # Vector similarity search in DB
        results = await self._repo.similarity_search(
            self.project_id, query_vec, top_k
        )

        if not results:
            return "No codebase context available yet."

        # Format output — identical to original ProjectRAG.retrieve()
        parts = [
            f"### {r.file_path} (lines {r.start_line}-{r.end_line})\n"
            f"```\n{r.content}\n```"
            for r in results
        ]
        return "\n\n".join(parts)

    async def get_file_tree(self) -> str:
        """Returns sorted list of indexed file paths, one per line."""
        files = await self._repo.get_indexed_files(self.project_id)
        return "\n".join(files) if files else "(no files indexed)"


# ── Private helpers ───────────────────────────────────────────────────────────

def _split_into_chunks(
    file_path: str,
    content: str,
    chunk_size: int,
) -> list[dict]:
    """
    Split file content into chunks of `chunk_size` lines.
    Returns plain dicts — embedding is added later by index_file().
    """
    lines = content.split("\n")
    chunks = []
    for start in range(0, len(lines), chunk_size):
        end = min(start + chunk_size, len(lines))
        chunks.append(
            {
                "content": "\n".join(lines[start:end]),
                "start_line": start + 1,
                "end_line": end,
            }
        )
    return chunks