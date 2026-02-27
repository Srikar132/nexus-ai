"""
core/redis.py

Redis bridge between Celery workers and FastAPI SSE endpoint.

═══════════════════════════════════════════════════════════════════
THE REAL STREAMING BUG — uvicorn response buffering
═══════════════════════════════════════════════════════════════════

The original code did this in subscribe_and_stream():

    yield f"data: {raw}\\n\\n"
    await asyncio.sleep(0)   # ← THIS DOES NOTHING FOR FLUSHING

asyncio.sleep(0) just yields control back to the event loop. It does
NOT flush uvicorn's write buffer. Uvicorn (the ASGI server) has its
own internal buffer for HTTP response chunks. It accumulates yielded
strings and only sends them when:
  a) the buffer is full, or
  b) the generator/connection closes

So ALL your SSE events (thinking, step, tool_call, text_chunk × 200)
were sitting in uvicorn's buffer and sent in ONE TCP packet when the
stream ended. The frontend received everything at once.

THE FIX: Two parts working together:

1. StreamingResponse headers — already correct in message_router.py:
     Cache-Control: no-cache
     X-Accel-Buffering: no     ← tells nginx not to buffer
     Connection: keep-alive

2. The generator must yield the SSE comment ": keep-alive\\n\\n" trick
   OR use a custom ASGI response that flushes. The real issue though
   is that standard StreamingResponse with uvicorn buffers until it
   sees enough data.

   The CORRECT fix: add a comment ping after each event. The SSE spec
   allows ": comment\\n\\n" lines which are ignored by EventSource but
   force the ASGI server to flush the current buffer because the
   generator has yielded a complete SSE message frame.

   Even better: replace StreamingResponse with a custom response class
   that calls send() directly on the ASGI scope, which bypasses
   uvicorn's StreamingResponse buffer entirely.

In message_router.py, change the endpoint to use EventSourceResponse
from the sse-starlette package, which handles flushing correctly.
OR use the manual ASGI approach below.

SIMPLEST FIX that works without extra dependencies:
  In subscribe_and_stream, after each yield, also yield an SSE comment.
  This forces uvicorn to treat each event as a complete chunk because
  the buffer sees two consecutive \\n\\n boundaries close together and
  flushes.

  Actually the REAL simplest fix is: switch to sse-starlette.
  `pip install sse-starlette` and use EventSourceResponse — it handles
  all buffering/flushing correctly and is the standard FastAPI SSE solution.

We implement BOTH: the generator is correct, AND we document the
EventSourceResponse swap in message_router.py.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncGenerator

import redis.asyncio as aioredis
import redis as sync_redis_lib

from app.core.config import settings

log = logging.getLogger(__name__)

# ── Terminal event types ───────────────────────────────────────────
TERMINAL_EVENTS    = frozenset({"done", "build_failed"})
CLOSE_STREAM_EVENT = "close_stream"

# ── Sync client (Celery workers) ──────────────────────────────────
_sync_client: sync_redis_lib.Redis | None = None


def _get_sync_client() -> sync_redis_lib.Redis:
    global _sync_client
    if _sync_client is None:
        _sync_client = sync_redis_lib.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=20,
        )
    return _sync_client


# ── Async pool (FastAPI SSE endpoint) ─────────────────────────────
_async_pool: aioredis.ConnectionPool | None = None


def _get_async_pool() -> aioredis.ConnectionPool:
    global _async_pool
    if _async_pool is None:
        _async_pool = aioredis.ConnectionPool.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=50,
        )
    return _async_pool


async def _get_async_client() -> aioredis.Redis:
    return aioredis.Redis(connection_pool=_get_async_pool())


# ── Channel helper ────────────────────────────────────────────────

def _channel(project_id: str) -> str:
    return f"project:{project_id}:stream"


# ── Publish (called from Celery workers — sync) ───────────────────

def publish(project_id: str, event: dict) -> None:
    client  = _get_sync_client()
    payload = json.dumps(event)
    channel = _channel(project_id)
    client.publish(channel, payload)
    log.debug("[REDIS PUB] project=%s type=%s", project_id, event.get("type"))


# ── Subscribe & stream (called from FastAPI — async) ──────────────

async def subscribe_and_stream(project_id: str) -> AsyncGenerator[str, None]:
    """
    Async generator for SSE endpoint.

    IMPORTANT — read this before touching this function:

    This generator is consumed by sse-starlette's EventSourceResponse
    (see message_router.py). Each yielded string is sent as a complete
    SSE frame and flushed to the client immediately.

    If you're using FastAPI's built-in StreamingResponse instead of
    EventSourceResponse, events WILL be buffered and the stream will
    appear broken. Switch to EventSourceResponse — it's the fix.

    The generator yields raw SSE-formatted strings:
        "data: <json>\\n\\n"

    sse-starlette handles the keep-alive pings automatically.
    """
    client  = await _get_async_client()
    channel = _channel(project_id)
    pubsub  = client.pubsub()

    try:
        await pubsub.subscribe(channel)
        log.info("[REDIS SUB] project=%s subscribed", project_id)

        async for message in pubsub.listen():
            if message["type"] != "message":
                continue

            raw = message["data"]

            try:
                event = json.loads(raw)
                event_type = event.get("type")

                if event_type == CLOSE_STREAM_EVENT:
                    log.info("[REDIS SUB] project=%s close_stream received", project_id)
                    # Yield the close event so frontend knows stream ended cleanly
                    yield f"data: {raw}\n\n"
                    break

                if event_type in TERMINAL_EVENTS:
                    log.info("[REDIS SUB] project=%s terminal event: %s", project_id, event_type)

            except (json.JSONDecodeError, AttributeError):
                pass

            # Yield the SSE frame
            yield f"data: {raw}\n\n"

    except asyncio.CancelledError:
        # Client disconnected — normal, not an error
        log.info("[REDIS SUB] project=%s client disconnected", project_id)

    except Exception as e:
        log.exception("[REDIS SUB] Error streaming project=%s", project_id)
        yield f"data: {json.dumps({'type': 'build_failed', 'reason': str(e)})}\n\n"

    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()
            await client.aclose()
        except Exception:
            pass
        log.info("[REDIS SUB] project=%s connection closed", project_id)