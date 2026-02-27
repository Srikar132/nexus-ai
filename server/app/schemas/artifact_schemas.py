from .base import BModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class ArtifactResponse(BModel):
    """Schema for artifact response."""
    id: UUID
    artifact_type: str  # plan | file | security_report | deployment
    title: str
    content: dict
    file_storage_url: Optional[str] = None
    build_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ArtifactUpdateRequest(BModel):
    """Schema for updating artifact content."""
    content: dict


class ArtifactUpdateResponse(BModel):
    """Schema for artifact update response."""
    id: UUID
    content: dict

    class Config:
        from_attributes = True
