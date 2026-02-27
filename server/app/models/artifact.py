from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
import uuid

from app.core.database import Base


class Artifact(Base):
    __tablename__ = "artifacts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"))
    build_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("builds.id", ondelete="SET NULL"), nullable=True)
    
    # Artifact Type: plan|file|security_report|deployment
    artifact_type: Mapped[str] = mapped_column(String, nullable=False)
    
    # Human-readable label
    title: Mapped[str] = mapped_column(String, nullable=False)
    
    # Structured content (plan, file metadata, deployment summary, security report, etc.)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    
    # For file artifacts (actual content stored externally)
    file_storage_url: Mapped[str] = mapped_column(String, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="artifacts") # type: ignore
    build: Mapped["Build"] = relationship("Build", back_populates="artifacts") # pyright: ignore[reportUndefinedVariable]