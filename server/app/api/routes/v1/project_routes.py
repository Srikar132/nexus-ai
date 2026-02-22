from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from app.core.database import get_db
from app.schemas.project_schemas import CreateProject, ProjectResponse, ProjectListResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.project_service import create_project as create_project_service, get_user_projects
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/projects", tags=["projects"])



# POST   /projects              → create project
@router.post("/", response_model=ProjectResponse)
async def create_project(
    project: CreateProject,
    db: AsyncSession = Depends(get_db),
    user : User = Depends(get_current_user)
):
    try:
        new_project = await create_project_service(
            db,
            user_id=user.id,
            name=project.name or None,
            description=project.description or None,
            target_framework=project.target_framework or None,
            target_language=project.target_language or None,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return new_project

# GET    /projects              → list all projects (for current user)
@router.get("/", response_model=ProjectListResponse)
async def list_user_projects(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Get all projects for the current authenticated user with pagination.
    """
    try:
        projects, total = await get_user_projects(
            db=db,
            user_id=user.id,
            page=page,
            limit=limit
        )
        
        return ProjectListResponse(
            projects=projects,
            total=total,
            page=page,
            limit=limit
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching projects: {str(e)}"
        )











# GET    /projects/:id          → get single project
# PATCH  /projects/:id          → update project (name, description)
# DELETE /projects/:id          → delete project