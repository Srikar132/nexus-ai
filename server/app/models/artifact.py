from sqlalchemy import (
    Column,
    Text,
    TIMESTAMP,
    ForeignKey,
    CheckConstraint,
    Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base


class Artifact(Base):
    __tablename__ = "artifacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign Keys
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False
    )


    # Artifact Type
    artifact_type = Column(
        Text,
        nullable=False
    )

    # Human-readable label
    title = Column(Text, nullable=False)

    # Structured content (plan, file metadata, deployment summary, etc.)
    content = Column(
        JSONB,
        nullable=False,
        server_default="{}"
    )

    # For file artifacts (actual content stored externally)
    file_storage_url = Column(Text, nullable=True)

    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            """
            artifact_type IN (
                'plan',
                'deployment'
            )
            """,
            name="check_artifact_type"
        ),
        Index("idx_artifacts_project_id", "project_id"),
        Index("idx_artifacts_type", "artifact_type"),
    )

    # Relationships
    project = relationship(
        "Project",
        backref="artifacts",
        passive_deletes=True
    )