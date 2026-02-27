from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.repositories.project_repo import ProjectRepo
from app.repositories.artifact_repo import ArtifactRepo
from app.schemas.artifact_schemas import (
    ArtifactResponse,
    ArtifactUpdateRequest,
    ArtifactUpdateResponse,
)


router = APIRouter(
    prefix="/projects/{project_id}/artifacts",
    tags=["artifacts"],
)


# ── Helpers ───────────────────────────────────────────────────────

async def _check_project(project_id: UUID, user_id: UUID, db: AsyncSession):
    """Verify the project exists and belongs to the user."""
    project = await ProjectRepo(db).get_by_id(project_id, user_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


# ════════════════════════════════════════════════════════════════════
# ARTIFACTS (read + update plan content for editing before approval)
# ════════════════════════════════════════════════════════════════════

@router.get("/{artifact_id}", response_model=ArtifactResponse)
async def get_artifact(
    project_id: UUID,
    artifact_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific artifact by ID."""
    await _check_project(project_id, current_user.id, db)
    artifact = await ArtifactRepo(db).get_by_id(artifact_id, project_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return artifact


@router.patch("/{artifact_id}", response_model=ArtifactUpdateResponse)
async def update_artifact(
    project_id: UUID,
    artifact_id: UUID,
    body: ArtifactUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update an artifact's content directly.

    NOTE: In the new conversational flow, users edit plans by CHATTING
    ("Change SMTP to SendGrid"), not via this endpoint.
    This endpoint exists for UI scenarios where user wants to directly
    tweak a plan field in the artifact card.
    Plan editing via conversation is preferred and more powerful.
    """
    await _check_project(project_id, current_user.id, db)
    artifact = await ArtifactRepo(db).get_by_id(artifact_id, project_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    updated = await ArtifactRepo(db).update(artifact_id, project_id, content=body.content)
    return updated
