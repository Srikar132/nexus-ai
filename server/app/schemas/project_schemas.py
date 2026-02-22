from .base import BModel
from typing import List, Optional
from datetime import datetime
from uuid import UUID


class CreateProject(BModel):
    name: str | None = None
    description: str | None = None

    target_framework: str | None = None  # fastapi, flask, express
    target_language: str | None = None  # python, javascript, go

    user_prompt: str | None = None


class ProjectResponse(BModel):
    id: UUID
    name: str
    description: Optional[str] = None
    slug: str
    
    target_framework: Optional[str] = None
    target_language: Optional[str] = None
    
    # Status and build info
    status: str  # initializing, building, deployed
    total_builds: int
    successful_builds: int
    failed_builds: int
    
    # Deployment info
    latest_deployed_url: Optional[str] = None
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ProjectListResponse(BModel):
    projects: List[ProjectResponse]
    total: int
    page: int
    limit: int