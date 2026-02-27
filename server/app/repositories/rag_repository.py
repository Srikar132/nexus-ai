"""
agents/rag/repository.py

All database operations for the RAG system.
Uses asyncpg directly for maximum performance with Neon serverless Postgres.

Responsibilities:
  - Create schema (table + HNSW index)
  - Batch insert code chunks with embeddings
  - Vector similarity search filtered by project_id

Connection pooling notes for Neon:
  - Neon serverless has a max of ~10 concurrent connections on free tier.
  - We use min_size=1, max_size=5 to stay safe.
  - statement_cache_size=0 is REQUIRED for PgBouncer/Neon pooling mode.
"""
import asyncpg
from dataclasses import dataclass
from typing import Optional


# ── Data shape returned from DB queries ──────────────────────────────────────

@dataclass
class ChunkRow:
    file_path: str
    content: str
    start_line: int
    end_line: int
    similarity: float


# ── Schema DDL ────────────────────────────────────────────────────────────────

_DDL_EXTENSION = "CREATE EXTENSION IF NOT EXISTS vector;"

_DDL_TABLE = """
CREATE TABLE IF NOT EXISTS code_chunks (
    id          BIGSERIAL PRIMARY KEY,
    project_id  TEXT        NOT NULL,
    file_path   TEXT        NOT NULL,
    content     TEXT        NOT NULL,
    start_line  INTEGER     NOT NULL,
    end_line    INTEGER     NOT NULL,
    embedding   VECTOR(384) NOT NULL
);
"""

_DDL_PROJECT_INDEX = """
CREATE INDEX IF NOT EXISTS idx_code_chunks_project_id
    ON code_chunks (project_id);
"""

# HNSW index for fast approximate cosine similarity search.
# m=16, ef_construction=64 are good defaults for code-sized datasets.
# Tune up if recall is poor; tune down if index build is too slow.
_DDL_HNSW_INDEX = """
CREATE INDEX IF NOT EXISTS idx_code_chunks_embedding_hnsw
    ON code_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
"""

# ── Pool factory ──────────────────────────────────────────────────────────────

async def create_pool(dsn: str) -> asyncpg.Pool:
    """
    Create a connection pool tuned for Neon serverless.

    statement_cache_size=0 is critical — Neon uses PgBouncer in transaction
    mode, which does not support prepared statements across connections.
    """
    return await asyncpg.create_pool(
        dsn,
        min_size=1,
        max_size=5,
        statement_cache_size=0,  # required for Neon / PgBouncer
        command_timeout=30,
    )


# ── Repository ────────────────────────────────────────────────────────────────

class ChunkRepository:
    """
    Thin async repository. All methods accept a pool and operate within
    a single acquired connection to avoid pool starvation on batch ops.
    """

    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool

    # ── Schema setup ──────────────────────────────────────────────

    async def ensure_schema(self) -> None:
        """
        Idempotent schema creation. Safe to call on every startup.
        Run in order: extension → table → btree index → HNSW index.
        """
        async with self._pool.acquire() as conn:
            await conn.execute(_DDL_EXTENSION)
            await conn.execute(_DDL_TABLE)
            await conn.execute(_DDL_PROJECT_INDEX)
            await conn.execute(_DDL_HNSW_INDEX)

    # ── Write ──────────────────────────────────────────────────────

    async def delete_file_chunks(self, project_id: str, file_path: str) -> None:
        """
        Remove all chunks for a specific file before re-indexing.
        Called by index_file() to handle file updates cleanly.
        """
        async with self._pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM code_chunks WHERE project_id = $1 AND file_path = $2",
                project_id,
                file_path,
            )

    async def insert_chunks(
        self,
        project_id: str,
        file_path: str,
        chunks: list[dict],
    ) -> None:
        """
        Batch insert chunks using copy_records_to_table for maximum throughput.

        Each dict in `chunks` must have:
            content, start_line, end_line, embedding (list[float])

        asyncpg's copy_records_to_table bypasses row-by-row overhead and
        is 10-50x faster than executemany for bulk inserts.
        """
        if not chunks:
            return

        records = [
            (
                project_id,
                file_path,
                c["content"],
                c["start_line"],
                c["end_line"],
                c["embedding"],   # asyncpg serializes list[float] → vector
            )
            for c in chunks
        ]

        async with self._pool.acquire() as conn:
            await conn.copy_records_to_table(
                "code_chunks",
                records=records,
                columns=["project_id", "file_path", "content", "start_line", "end_line", "embedding"],
            )

    # ── Read ───────────────────────────────────────────────────────

    async def similarity_search(
        self,
        project_id: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[ChunkRow]:
        """
        Cosine similarity search scoped to a project.

        The <=> operator is pgvector's cosine distance (lower = more similar).
        We return (1 - distance) as similarity for human-readable scores.

        The HNSW index is used automatically by Postgres for this query shape.
        """
        sql = """
            SELECT
                file_path,
                content,
                start_line,
                end_line,
                1 - (embedding <=> $1::vector) AS similarity
            FROM code_chunks
            WHERE project_id = $2
            ORDER BY embedding <=> $1::vector
            LIMIT $3;
        """
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(sql, query_embedding, project_id, top_k)

        return [
            ChunkRow(
                file_path=row["file_path"],
                content=row["content"],
                start_line=row["start_line"],
                end_line=row["end_line"],
                similarity=row["similarity"],
            )
            for row in rows
        ]

    async def get_indexed_files(self, project_id: str) -> list[str]:
        """Returns distinct file paths indexed for a project."""
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT DISTINCT file_path FROM code_chunks WHERE project_id = $1 ORDER BY file_path",
                project_id,
            )
        return [row["file_path"] for row in rows]