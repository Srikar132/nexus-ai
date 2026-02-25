"""
agents/rag.py

RAG (Retrieval Augmented Generation) for agent context.

Indexes the current project's files so all 3 agents can
retrieve relevant code context without reading the full codebase.

Storage: In-memory for simplicity (use ChromaDB / pgvector in production).

Flow:
  1. Artificer writes a file → index_file() adds it to RAG
  2. Any agent calls retrieve() with a query
  3. RAG returns the most relevant code snippets
  4. Agent includes them in its context window
"""
import hashlib
from dataclasses import dataclass
from typing import Optional
import anthropic
from app.core.config import settings

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


@dataclass
class CodeChunk:
    file_path:  str
    content:    str
    start_line: int
    end_line:   int


class ProjectRAG:
    """
    Simple in-memory RAG for one project's codebase.
    One instance per build — lives in the Celery worker memory.

    For production: swap _store with ChromaDB or pgvector.
    """

    def __init__(self, project_id: str):
        self.project_id = project_id
        self._chunks: list[CodeChunk]     = []
        self._embeddings: list[list[float]] = []

    def index_file(self, file_path: str, content: str):
        """
        Called by Artificer after writing a file.
        Splits file into chunks and indexes them.
        """
        chunks = self._split_into_chunks(file_path, content)
        for chunk in chunks:
            embedding = self._embed(chunk.content)
            self._chunks.append(chunk)
            self._embeddings.append(embedding)

    def retrieve(self, query: str, top_k: int = 5) -> str:
        """
        Returns formatted context string with most relevant code chunks.
        Agents pass this as part of their prompt.
        """
        if not self._chunks:
            return "No codebase context available yet."

        query_embedding = self._embed(query)
        scores = [
            self._cosine_similarity(query_embedding, emb)
            for emb in self._embeddings
        ]

        # Get top-k chunks by similarity score
        top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]

        result_parts = []
        for idx in top_indices:
            chunk = self._chunks[idx]
            result_parts.append(
                f"### {chunk.file_path} (lines {chunk.start_line}-{chunk.end_line})\n"
                f"```\n{chunk.content}\n```"
            )

        return "\n\n".join(result_parts)

    def get_file_tree(self) -> str:
        """Returns a simple file tree string for agent context"""
        files = list({c.file_path for c in self._chunks})
        return "\n".join(sorted(files))

    # ── Private helpers ───────────────────────────────────────────

    def _split_into_chunks(self, file_path: str, content: str, chunk_size: int = 50) -> list[CodeChunk]:
        """Split file into chunks of ~50 lines each"""
        lines  = content.split("\n")
        chunks = []
        for start in range(0, len(lines), chunk_size):
            end         = min(start + chunk_size, len(lines))
            chunk_text  = "\n".join(lines[start:end])
            chunks.append(CodeChunk(
                file_path  = file_path,
                content    = chunk_text,
                start_line = start + 1,
                end_line   = end
            ))
        return chunks

    def _embed(self, text: str) -> list[float]:
        """
        Get embedding vector from Anthropic.
        NOTE: Anthropic doesn't have embeddings API yet.
        Use OpenAI embeddings or a local model like sentence-transformers.

        For now using a simple hash-based mock — replace in production.
        """
        # ── PRODUCTION: use sentence-transformers ──────────────────
        # from sentence_transformers import SentenceTransformer
        # model = SentenceTransformer("all-MiniLM-L6-v2")
        # return model.encode(text).tolist()
        # ──────────────────────────────────────────────────────────

        # Mock embedding for development
        h = hashlib.md5(text.encode()).digest()
        return [b / 255.0 for b in h]  # 16-dim mock vector

    def _cosine_similarity(self, a: list[float], b: list[float]) -> float:
        dot     = sum(x * y for x, y in zip(a, b))
        norm_a  = sum(x ** 2 for x in a) ** 0.5
        norm_b  = sum(x ** 2 for x in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)