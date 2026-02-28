"""
api/routes/message_router.py

Message endpoints for project chat + build pipeline.

FLOW:
  POST /messages  — user sends a message → start or resume workflow
  GET  /messages  — paginated chat history
  GET  /messages/stream — SSE stream (EventSourceResponse for true per-event flush)

Deployer fetches credentials internally from the User DB record.
No env var form, no Railway connect flow, no deploy_confirm task.
"""

from __future__ import annotations

import logging
import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.redis import subscribe_and_stream
from app.models.user import User
from app.repositories.artifact_repo import ArtifactRepo
from app.repositories.build_repo import BuildRepo
from app.repositories.message_repo import MessageRepo
from app.repositories.project_repo import ProjectRepo
from app.schemas.enums import ACTION_TO_MESSAGE_TYPE, UserAction
from app.schemas.message_schemas import SendMessageRequest
from app.schemas.project_schemas import SendMessageResponse
from app.tasks.build_worker import resume_workflow_task, start_workflow_task

router = APIRouter(prefix="/projects/{project_id}", tags=["messages"])
log    = logging.getLogger(__name__)


# ── Serialiser ────────────────────────────────────────────────────

def _serialise(msg, artifact_map: dict) -> dict:
    blocks = []
    for block in (msg.content or []):
        if block.get("type") == "artifact":
            art = artifact_map.get(block.get("artifact_id"))
            blocks.append({
                **block,
                "artifact_data": {
                    "id":            str(art.id),
                    "artifact_type": art.artifact_type,
                    "title":         art.title,
                    "content":       art.content,
                } if art else None,
            })
        else:
            blocks.append(block)
    return {
        "id":           str(msg.id),
        "role":         msg.role,
        "message_type": msg.message_type,
        "content":      blocks,
        "metadata":     msg.metadata_,
        "created_at":   msg.created_at.isoformat(),
    }


# ════════════════════════════════════════════════════════════════════
# GET /messages — paginated chat history
# ════════════════════════════════════════════════════════════════════

@router.get("/messages")
async def get_messages(
    project_id:   UUID,
    offset:       int  = Query(0, ge=0),
    limit:        int  = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    project = await ProjectRepo(db).get_by_id(project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    messages, total = await MessageRepo(db).get_paginated(project_id, limit=limit, offset=offset)

    artifact_ids = [
        UUID(b["artifact_id"])
        for m in messages
        for b in (m.content or [])
        if b.get("type") == "artifact" and b.get("artifact_id")
    ]
    artifact_map = await ArtifactRepo(db).get_many_by_ids(artifact_ids)

    # Active build first, fall back to latest (for deploy URL after completion)
    active_build = await BuildRepo(db).get_active_build(project_id)
    if not active_build:
        active_build = await BuildRepo(db).get_latest_build(project_id)

    return {
        "messages": [_serialise(m, artifact_map) for m in messages],
        "total":    total,
        "offset":   offset,
        "has_more": (offset + limit) < total,
        "active_build": {
            "id":           str(active_build.id),
            "status":       active_build.status,
            "deploy_url":   active_build.deploy_url,
            "repo_url":     active_build.repo_url,
            "started_at":   active_build.started_at.isoformat() if active_build.started_at else None,
            "completed_at": active_build.completed_at.isoformat() if active_build.completed_at else None,
        } if active_build else None,
    }


# ════════════════════════════════════════════════════════════════════
# POST /messages — send a chat message or trigger a build
# ════════════════════════════════════════════════════════════════════

@router.post("/messages", response_model=SendMessageResponse)
async def send_message(
    project_id:   UUID,
    body:         SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    project = await ProjectRepo(db).get_by_id(project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    message_type = ACTION_TO_MESSAGE_TYPE.get(body.action)
    if not message_type:
        raise HTTPException(status_code=422, detail=f"Unknown action: {body.action}")

    total_messages   = await MessageRepo(db).count_messages(project_id)
    is_first_message = (total_messages == 0)

    user_msg = await MessageRepo(db).create(
        project_id   = project_id,
        role         = "user",
        message_type = "user_prompt",
        content      = [{"type": "text", "content": body.content or ""}],
    )

    thread_id = project.langgraph_thread_id

    if is_first_message:
        if not thread_id:
            thread_id = str(uuid.uuid4())
            await ProjectRepo(db).update(
                project_id, current_user.id, langgraph_thread_id=thread_id
            )
    else:
        if not thread_id:
            raise HTTPException(
                status_code=500,
                detail="Project has messages but no LangGraph thread ID.",
            )

    await db.commit()

    if is_first_message:
        start_workflow_task.delay(
            project_id          = str(project_id),
            thread_id           = thread_id,
            user_id             = str(current_user.id),
            user_message        = body.content or "",
            message_type        = message_type,
            project_name        = project.name,
            project_description = project.description or "",
        )
    else:
        resume_workflow_task.delay(
            project_id   = str(project_id),
            thread_id    = thread_id,
            user_id      = str(current_user.id),
            user_message = body.content or "",
            message_type = message_type,
        )

    return {
        "user_message_id": str(user_msg.id),
        "thread_id":       thread_id,
        "status":          "processing",
        "stream_url":      f"/projects/{project_id}/messages/stream",
    }


# ════════════════════════════════════════════════════════════════════
# GET /messages/stream — SSE endpoint
#
# EventSourceResponse (sse-starlette) flushes each event immediately.
# StreamingResponse buffers until connection close — do NOT use it.
# ════════════════════════════════════════════════════════════════════

@router.get("/messages/stream")
async def stream_messages(
    project_id:   UUID,
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    project = await ProjectRepo(db).get_by_id(project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    async def event_generator():
        async for sse_frame in subscribe_and_stream(str(project_id)):
            # sse_frame is "data: {...}\n\n" — strip so sse-starlette re-wraps + flushes
            yield sse_frame.removeprefix("data: ").rstrip("\n")

    return EventSourceResponse(event_generator(), ping=15)