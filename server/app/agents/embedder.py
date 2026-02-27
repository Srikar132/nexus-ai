"""
agents/rag/embedder.py

Handles embedding generation using sentence-transformers (local, free, fast).
Model: all-MiniLM-L6-v2 → 384-dimensional vectors.

Swap _MODEL_NAME for "text-embedding-3-small" + OpenAI client if you prefer.
"""
from functools import lru_cache
from sentence_transformers import SentenceTransformer

_MODEL_NAME = "all-MiniLM-L6-v2"
_VECTOR_DIM = 384  # must match VECTOR(384) in DB schema


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    """
    Load model once per process, cache it.
    lru_cache ensures a single instance even under concurrent calls.
    """
    return SentenceTransformer(_MODEL_NAME)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Batch-embed a list of strings.
    Returns a list of 384-dim float vectors — one per input text.

    Batching is handled internally by sentence-transformers
    (defaults to batch_size=32). For large files, this is significantly
    faster than embedding one chunk at a time.
    """
    if not texts:
        return []

    model = _get_model()
    embeddings = model.encode(
        texts,
        batch_size=32,
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    return [emb.tolist() for emb in embeddings]


def embed_query(query: str) -> list[float]:
    """
    Embed a single query string.
    Thin wrapper around embed_texts for clarity at call sites.
    """
    return embed_texts([query])[0]