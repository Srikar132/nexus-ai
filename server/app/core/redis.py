"""
Redis is the bridge between LangGraph workflow (runs in Celery) and SSE endpoint (FastAPI).
Channel per project: "project:{project_id}:stream"
"""

import json
import asyncio
import redis.asyncio as aioredis
import redis as sync_redis_lib
from app.core.config import settings

# Sync client — used inside Celery/LangGraph workers
sync_client = sync_redis_lib.from_url(settings.REDIS_URL, decode_responses=True)

# ── Async Redis (used inside FastAPI SSE endpoint) ────────────────
async def get_async_redis() -> aioredis.Redis:
    return await aioredis.from_url(settings.REDIS_URL, decode_responses=True)

def get_channel(project_id: str) -> str:
    return f"project:{project_id}:stream"



def publish(project_id: str, event: dict) -> None:
    """Publish event from worker to Redis channel"""
    sync_client.publish(get_channel(project_id), json.dumps(event))


async def subscribe_and_stream(project_id: str):
    """
    Async generator for SSE endpoint.
    Yields SSE-formatted strings until a terminal event is received.
    Terminal events: 'done', 'build_failed', 'worker_done'
    """
    redis  = await get_async_redis()
    pubsub = redis.pubsub()
    await pubsub.subscribe(get_channel(project_id))
    try:
        async for raw in pubsub.listen():
            if raw["type"] != "message":
                continue
            event = json.loads(raw["data"])
            yield f"data: {json.dumps(event)}\n\n"
            if event.get("type") in ("done", "build_failed", "worker_done"):
                break
            await asyncio.sleep(0)
    finally:
        await pubsub.unsubscribe(get_channel(project_id))
        await pubsub.close()
        await redis.aclose()