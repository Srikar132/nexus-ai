from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException , Query
from fastapi.responses import StreamingResponse
from test.test_reprlib import r
from app.schemas.message_schemas import SendMessageRequest, MessageListResponse
from app.schemas.project_schemas import SendMessageResponse
from app.api.deps import get_current_user
from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.repositories.project_repo import ProjectRepo
from app.repositories.message_repo import MessageRepo
from app.repositories.artifact_repo import ArtifactRepo
from app.core.redis import subscribe_and_stream

router = APIRouter(prefix="/projects/{project_id}", tags=["messages"])

# ── Helpers ───────────────────────────────────────────────────────

def _serialize(msg, artifact_map: dict) -> dict:
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
                } if art else None
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

@router.get("/messages", response_model=MessageListResponse)
async def get_messages(
    project_id: UUID,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all messages for a specific project.
    """
    project = await ProjectRepo(db).get_by_id(project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    messages, total = await MessageRepo(db).get_paginated(project_id, limit=limit, offset=offset)

    # Collect all artifact IDs in one pass
    artifact_ids = [
        UUID(b["artifact_id"])
        for m in messages
        for b in (m.content or [])
        if b.get("type") == "artifact" and b.get("artifact_id")
    ]
    artifact_map = await ArtifactRepo(db).get_many_by_ids(artifact_ids)

    return {
        "messages": [_serialize(m, artifact_map) for m in messages],
        "total": total,
        "offset": offset,
        "has_more": (offset + limit) < total,
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

    # ── Save user message to DB first ─────────────────────────────
    user_msg = await MessageRepo(db).create(
        project_id   = project_id,
        role         = "user",
        message_type = "user_prompt",
        content      = [{"type": "text", "content": body.content}]
    )

    thread_id = project.langgraph_thread_id

    # ── First message ever? Start new workflow. Else resume. ──────
    # Check if this project has any previous messages (excluding the one we just saved)
    _, total = await MessageRepo(db).get_paginated(project_id, limit=1, offset=0)
    is_first_message = (total <= 1)
    
    if is_first_message:
        # Start brand new LangGraph thread
        # start_workflow_task.delay(
        #     project_id          = str(project_id),
        #     thread_id           = thread_id,
        #     user_message        = body.content,
        #     project_name        = project.name,
        #     project_description = project.description or "",
        # )
        pass
    else:
        # Resume existing LangGraph thread with new user message
        # resume_workflow_task.delay(
        #     project_id   = str(project_id),
        #     thread_id    = thread_id,
        #     user_message = body.content,
        # )
        pass

    return {
        "user_message_id": str(user_msg.id),
        "thread_id":       thread_id,
        "status":          "processing",
        "stream_url":      f"/projects/{project_id}/messages/stream",
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
            "Cache-Control":               "no-cache",
            "X-Accel-Buffering":           "no",
            "Access-Control-Allow-Origin": "*",
        }
    )