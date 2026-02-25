from .base import BModel
from typing import List, Optional
from datetime import datetime
from uuid import UUID


class ProjectCreate(BModel):
    """Schema for creating a new project."""
    name: str
    description: str | None = None


class ProjectUpdate(BModel):
    """Schema for updating project fields."""
    name: str | None = None
    description: str | None = None
    status: str | None = None
    stack: dict | None = None
    repo_url: str | None = None
    latest_deploy_url: str | None = None


class ProjectResponse(BModel):
    """Schema for project response."""
    id: UUID
    name: str
    description: Optional[str] = None
    
    # Status and metadata
    status: str  # active, deleted, etc.
    stack: Optional[dict] = None
    
    # Git & Deployment
    repo_url: Optional[str] = None
    latest_deploy_url: Optional[str] = None
    
    # LangGraph integration
    langgraph_thread_id: Optional[str] = None
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ProjectListResponse(BModel):
    """Schema for paginated project list response."""
    projects: List[ProjectResponse]
    total: int
    page: int
    limit: int


class SendMessageResponse(BModel):
    """Schema for send message response."""
    user_message_id: UUID
    thread_id: str
    status: str
    stream_url: str
    
class DeployConfirmRequest(BModel):
    """
    Plaintext credentials decrypted in the browser.
    Sent over HTTPS only. Never stored in DB.
    """
    plaintext_vars:          dict[str, str]   # user's app env vars
    render_api_key:          str = ""         # decrypted Render key (if using Render)
    railway_api_key:         str = ""         # decrypted Railway key (if using Railway)
    deploy_provider:         str = "render"   # "render" | "railway"