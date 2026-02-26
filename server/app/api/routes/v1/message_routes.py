from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
import logging
from app.schemas.message_schemas import SendMessageRequest, MessageListResponse
from app.schemas.project_schemas import DeployConfirmRequest, SendMessageResponse
from app.schemas.enums import UserAction, ACTION_TO_MESSAGE_TYPE
from app.api.deps import get_current_user
from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.repositories.project_repo import ProjectRepo
from app.repositories.message_repo import MessageRepo
from app.repositories.artifact_repo import ArtifactRepo
from app.core.redis import subscribe_and_stream
from app.repositories.build_repo import BuildRepo
from app.tasks.build_task import deploy_confirm_task, start_workflow_task , resume_workflow_task

router = APIRouter(prefix="/projects/{project_id}", tags=["messages"])

# log = logging.

# ── Helpers ───────────────────────────────────────────────────────
# ── Serialise message + inject artifact data ──────────────────────

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
# GET /messages — load chat history
# ════════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════════
# GET /messages — paginated chat history
# ════════════════════════════════════════════════════════════════════

@router.get("/messages")
async def get_messages(
    project_id:   UUID,
    offset:       int = Query(0, ge=0),
    limit:        int = Query(50, ge=1, le=100),
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

    # Also include current build status so frontend knows if build is running
    active_build = await BuildRepo(db).get_active_build(project_id)

    return {
        "messages":           [_serialise(m, artifact_map) for m in messages],
        "total":              total,
        "offset":             offset,
        "has_more":           (offset + limit) < total,
        "active_build":       {
            "id":     str(active_build.id),
            "status": active_build.status,
        } if active_build else None,
    }


# ════════════════════════════════════════════════════════════════════
# POST /messages — user sends a message
# The ONLY entry point for ALL user interaction.
# LangGraph handles everything from here.
# ════════════════════════════════════════════════════════════════════
@router.post("/messages", response_model=SendMessageResponse)
async def send_message(
    project_id:   UUID,
    body:         SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db)
):
    project = await ProjectRepo(db).get_by_id(project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # ── Map frontend action → backend message_type ────────────────
    # Uses the enum-based mapping from schemas/enums.py.
    # The conductor node reads message_type — never parses text.
    message_type = ACTION_TO_MESSAGE_TYPE.get(body.action)
    if not message_type:
        raise HTTPException(status_code=422, detail=f"Unknown action: {body.action}")

    # ── provide_env_vars is handled by deploy-confirm, not normal message flow
    if body.action == UserAction.PROVIDE_ENV_VARS:
        if not body.vars:
            raise HTTPException(status_code=422, detail="vars required for provide_env_vars action")
        # Delegate to deploy_confirm_task
        active_build = await BuildRepo(db).get_active_build(project_id)
        if not active_build:
            raise HTTPException(status_code=409, detail="No active build waiting for deployment.")
        if not project.langgraph_thread_id:
            raise HTTPException(status_code=500, detail="No LangGraph thread ID.")

        deploy_confirm_task.delay(
            project_id     = str(project_id),
            thread_id      = project.langgraph_thread_id,
            user_id        = str(current_user.id),
            plaintext_vars = body.vars,
        )
        # Save a user message recording the action (not the vars!)
        user_msg = await MessageRepo(db).create(
            project_id   = project_id,
            role         = "user",
            message_type = "user_prompt",
            content      = [{"type": "text", "content": "Submitted environment variables for deployment."}]
        )
        await db.commit()
        return {
            "user_message_id": str(user_msg.id),
            "thread_id":       project.langgraph_thread_id,
            "status":          "deploying",
            "stream_url":      f"/projects/{project_id}/messages/stream",
        }

    # ── Save user message to DB first ─────────────────────────────
    display_content = body.content or ""
    if body.action == UserAction.APPROVE_PLAN:
        display_content = "✅ Approved the plan."
    elif body.action == UserAction.EDIT_PLAN:
        display_content = body.content or "Edited the plan."

    user_msg = await MessageRepo(db).create(
        project_id   = project_id,
        role         = "user",
        message_type = "user_prompt",
        content      = [{"type": "text", "content": display_content}]
    )

    thread_id = project.langgraph_thread_id

    # ── First message ever? Start new workflow. Else resume. ──────
    total_messages = await MessageRepo(db).count_messages(project_id)
    is_first_message = (total_messages <= 1)

    if is_first_message:
        if not thread_id:
            import uuid
            thread_id = str(uuid.uuid4())
            await ProjectRepo(db).update(project_id, current_user.id, langgraph_thread_id=thread_id)
    else:
        if not thread_id:
            raise HTTPException(
                status_code=500,
                detail="Project has messages but no LangGraph thread ID. Data inconsistency."
            )

    # ── Commit all DB changes before dispatching Celery task ──────
    await db.commit()

    # ── Build the payload that the Celery task passes to LangGraph ─
    # This becomes current_user_input in GraphState
    celery_payload = {
        "message":      body.content or "",
        "message_type": message_type,
    }
    if body.action == "edit_plan" and body.edited_plan:
        celery_payload["edited_plan"] = body.edited_plan

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
            edited_plan  = body.edited_plan if body.action == "edit_plan" else None,
        )

    return {
        "user_message_id": str(user_msg.id),
        "thread_id":       thread_id,
        "status":          "processing",
        "stream_url":      f"/projects/{project_id}/messages/stream",
    }




# ════════════════════════════════════════════════════════════════════
# POST /messages/deploy-confirm
# User sends plaintext app env vars (STRIPE_KEY, etc.)
# Platform credentials (GitHub token, Railway key) are fetched server-side.
# Resumes deployer node — credentials never stored.
# ════════════════════════════════════════════════════════════════════

@router.post("/messages/deploy-confirm")
async def deploy_confirm(
    project_id:   UUID,
    body:         DeployConfirmRequest,
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """
    SECURITY:
    - HTTPS only (enforce at nginx / load balancer)
    - Body is never logged (log.info below intentionally omits body content)
    - Celery task discards payload after use
    - result_expires = 60s so Redis doesn't hold payload long
    """
    # from app.workers.build_worker import deploy_confirm_task

    project = await ProjectRepo(db).get_by_id(project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Confirm there is a build waiting for env vars
    active_build = await BuildRepo(db).get_active_build(project_id)
    if not active_build:
        raise HTTPException(status_code=409, detail="No active build waiting for deployment.")

    # log.info(
    #     "deploy_confirm project=%s build=%s provider=%s vars_count=%d",
    #     project_id, active_build.id, body.deploy_provider, len(body.plaintext_vars),
    # )
    # ↑ intentionally NOT logging body.plaintext_vars or any credential

    # Safety check: ensure thread_id exists for deployment
    if not project.langgraph_thread_id:
        raise HTTPException(
            status_code=500, 
            detail="Project has no LangGraph thread ID. Cannot resume deployment."
        )

    deploy_confirm_task.delay(
        project_id     = str(project_id),
        thread_id      = project.langgraph_thread_id,
        user_id        = str(current_user.id),
        plaintext_vars = body.plaintext_vars,
    )

    # Wipe from local scope immediately
    del body

    return {
        "status":     "deploying",
        "stream_url": f"/projects/{project_id}/messages/stream",
        "message":    "Deployment started. Connect to stream for live updates.",
    }




# ════════════════════════════════════════════════════════════════════
# GET /messages/stream — SSE endpoint
# Frontend connects here to receive real-time events from LangGraph
# ════════════════════════════════════════════════════════════════════

@router.get("/messages/stream")
async def stream_messages(
    project_id:   UUID,
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db)
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
        }
    )


