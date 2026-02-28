from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.repositories.project_repo import ProjectRepo
from app.repositories.build_repo import BuildRepo
from app.schemas.build_schemas import (
    BuildSummaryResponse,
    BuildDetailResponse,
    BuildListResponse,
)


router = APIRouter(
    prefix="/projects/{project_id}/builds",
    tags=["builds"],
)


# ── Helpers ───────────────────────────────────────────────────────

async def _check_project(project_id: UUID, user_id: UUID, db: AsyncSession):
    """Verify the project exists and belongs to the user."""
    project = await ProjectRepo(db).get_by_id(project_id, user_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


# ════════════════════════════════════════════════════════════════════
# BUILDS (read-only — builds are managed entirely by LangGraph)
# ════════════════════════════════════════════════════════════════════

@router.get("/", response_model=BuildListResponse)
async def list_builds(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all builds for a project."""
    await _check_project(project_id, current_user.id, db)
    builds = await BuildRepo(db).list_by_project(project_id)
    return {"builds": builds}


@router.get("/{build_id}", response_model=BuildDetailResponse)
async def get_build(
    project_id: UUID,
    build_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full details of a specific build."""
    await _check_project(project_id, current_user.id, db)
    build = await BuildRepo(db).get_by_id(build_id, project_id)
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    return build


@router.get("/active/status")
async def get_active_build_status(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the status of the currently active build for a project.
    Returns build details including status and deploy_url if available.
    """
    await _check_project(project_id, current_user.id, db)
    build = await BuildRepo(db).get_active_build(project_id)
    
    if not build:
        return {
            "has_active_build": False,
            "build": None
        }
    
    return {
        "has_active_build": True,
        "build": {
            "id": str(build.id),
            "build_number": build.build_number,
            "status": build.status,
            "deploy_url": build.deploy_url,
            "repo_url": build.repo_url,
            "error_message": build.error_message,
            "started_at": build.started_at.isoformat() if build.started_at else None,
            "completed_at": build.completed_at.isoformat() if build.completed_at else None,
        }
    }
