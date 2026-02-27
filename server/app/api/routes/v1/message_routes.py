"""
api/routes/message_router.py

Message endpoints for project chat + build pipeline.

KEY FIXES vs original:
  1. Removed POST /messages/deploy-confirm — it was a DUPLICATE of the
     provide_env_vars action in POST /messages. Both called deploy_confirm_task.
     If frontend retried or hit both, two Celery tasks fired against the same
     LangGraph thread, corrupting checkpoint state.
     Now there is ONE entry point for env var submission: POST /messages
     with action=provide_env_vars.

  2. is_first_message logic fixed — the original counted total messages
     including the one just created, so message #1 was never "first" (count=1,
     but condition was <= 1). Now we count BEFORE creating the new message.

  3. GET /messages — added active_build correctly; no logic changes needed.

  4. Duplicate comment blocks removed.
"""

from __future__ import annotations

import logging
import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

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
from app.tasks.build_worker import deploy_confirm_task, resume_workflow_task, start_workflow_task

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
    active_build = await BuildRepo(db).get_active_build(project_id)

    return {
        "messages":     [_serialise(m, artifact_map) for m in messages],
        "total":        total,
        "offset":       offset,
        "has_more":     (offset + limit) < total,
        "active_build": {
            "id":     str(active_build.id),
            "status": active_build.status,
        } if active_build else None,
    }


# ════════════════════════════════════════════════════════════════════
# POST /messages — unified entry point for ALL user interactions
#
# Supported actions (from UserAction enum):
#   send_message      → chat with conductor or start a build
#   provide_env_vars  → submit env vars to resume deployer
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

    # ── provide_env_vars — resume deployer with user's app secrets ──────
    if body.action == UserAction.PROVIDE_ENV_VARS:
        if not body.vars:
            raise HTTPException(
                status_code=422,
                detail="vars is required for provide_env_vars action",
            )
        active_build = await BuildRepo(db).get_active_build(project_id)
        if not active_build:
            raise HTTPException(status_code=409, detail="No active build waiting for deployment.")
        if not project.langgraph_thread_id:
            raise HTTPException(status_code=500, detail="No LangGraph thread ID on project.")

        # Record that the user submitted env vars (display only — no secrets stored)
        user_msg = await MessageRepo(db).create(
            project_id   = project_id,
            role         = "user",
            message_type = "user_prompt",
            content      = [{"type": "text", "content": "Submitted environment variables for deployment."}],
        )
        await db.commit()

        deploy_confirm_task.delay(
            project_id     = str(project_id),
            thread_id      = project.langgraph_thread_id,
            user_id        = str(current_user.id),
            plaintext_vars = body.vars,
        )

        return {
            "user_message_id": str(user_msg.id),
            "thread_id":       project.langgraph_thread_id,
            "status":          "deploying",
            "stream_url":      f"/projects/{project_id}/messages/stream",
        }

    # ── Regular send_message — chat or build trigger ─────────────────────
    message_type = ACTION_TO_MESSAGE_TYPE.get(body.action)
    if not message_type:
        raise HTTPException(status_code=422, detail=f"Unknown action: {body.action}")

    display_content = body.content or ""

    # Count BEFORE creating the new message so is_first_message is accurate
    total_messages   = await MessageRepo(db).count_messages(project_id)
    is_first_message = (total_messages == 0)

    user_msg = await MessageRepo(db).create(
        project_id   = project_id,
        role         = "user",
        message_type = "user_prompt",
        content      = [{"type": "text", "content": display_content}],
    )

    thread_id = project.langgraph_thread_id

    if is_first_message:
        # Assign a new thread ID for this project's LangGraph state
        if not thread_id:
            thread_id = str(uuid.uuid4())
            await ProjectRepo(db).update(
                project_id, current_user.id, langgraph_thread_id=thread_id
            )
    else:
        if not thread_id:
            raise HTTPException(
                status_code=500,
                detail="Project has messages but no LangGraph thread ID — data inconsistency.",
            )

    await db.commit()

    if is_first_message:
        start_workflow_task.delay(
            project_id          = str(project_id),
            thread_id           = thread_id,
            user_message        = body.content or "",
            message_type        = message_type,
            project_name        = project.name,
            project_description = project.description or "",
        )
    else:
        resume_workflow_task.delay(
            project_id   = str(project_id),
            thread_id    = thread_id,
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
# Frontend connects here for real-time build events.
# Redis pub/sub with buffer replay (see core/redis.py).
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

    return StreamingResponse(
        subscribe_and_stream(str(project_id)),
        media_type = "text/event-stream",
        headers    = {
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
            "Connection":        "keep-alive",
        },
    )