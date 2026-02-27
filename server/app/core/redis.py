"""
core/redis.py

Redis bridge between Celery workers and FastAPI SSE endpoint.

Simple pub/sub streaming - no buffering, direct event delivery.
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

# ── Terminal event types — both sides must agree ──────────────────
TERMINAL_EVENTS = frozenset({"done", "build_failed"})
CLOSE_STREAM_EVENT = "close_stream"  # Explicitly closes the SSE connection

# ── Sync client (Celery workers) ──────────────────────────────────
# One module-level client — sync_redis_lib already manages a connection pool.
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
# One shared pool; individual connections checked out per coroutine.
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
    """
    Publish event to pub/sub channel.
    """
    client  = _get_sync_client()
    payload = json.dumps(event)
    channel = _channel(project_id)

    client.publish(channel, payload)
    log.debug("[REDIS PUB] project=%s type=%s", project_id, event.get("type"))


# ── Subscribe & stream (called from FastAPI — async) ──────────────

async def subscribe_and_stream(project_id: str) -> AsyncGenerator[str, None]:
    """
    Async generator for SSE endpoint.
    
    Subscribes to pub/sub channel and streams ALL events.
    Connection stays open until 'close_stream' event or client disconnects.
    Yields SSE-formatted strings: "data: <json>\\n\\n"
    """
    client = await _get_async_client()
    channel = _channel(project_id)
    pubsub = client.pubsub()

    try:
        await pubsub.subscribe(channel)
        log.info("[REDIS SUB] project=%s subscribed", project_id)

        async for message in pubsub.listen():
            if message["type"] != "message":
                continue

            raw = message["data"]
            
            # Check if this is the close signal BEFORE yielding
            try:
                event = json.loads(raw)
                if event.get("type") == CLOSE_STREAM_EVENT:
                    log.info("[REDIS SUB] project=%s received close_stream signal", project_id)
                    break
                
                # Log terminal events but continue streaming
                if event.get("type") in TERMINAL_EVENTS:
                    log.info("[REDIS SUB] project=%s received terminal event: %s", 
                            project_id, event.get("type"))
            except (json.JSONDecodeError, AttributeError):
                pass
            
            yield f"data: {raw}\n\n"
            await asyncio.sleep(0)  # yield control to event loop

    except Exception as e:
        log.exception("[REDIS SUB] Error streaming project=%s", project_id)
        yield f"data: {json.dumps({'type': 'build_failed', 'reason': str(e)})}\n\n"
    
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
        await client.aclose()
        log.info("[REDIS SUB] project=%s connection closed", project_id)