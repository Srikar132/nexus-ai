from sqlalchemy import (
    Column,
    Integer,
    Text,
    TIMESTAMP,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base


class Build(Base):
    __tablename__ = "builds"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign Key
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False
    )

    # Auto-increment per project (handled by database trigger)
    build_number = Column(Integer, nullable=False)

    # Status
    status = Column(
        Text,
        nullable=False,
        default="planning"
    )

    # Plans
    raw_plan = Column(JSONB, nullable=True)
    approved_plan = Column(JSONB, nullable=True)


    # Outcome
    deploy_url = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    # Timing
    started_at = Column(TIMESTAMP(timezone=True), nullable=True)
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)

    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            """
            status IN (
                'planning',
                'approved',
                'building',
                'completed',
                'failed'
            )
            """,
            name="check_build_status"
        ),
        UniqueConstraint(
            "project_id",
            "build_number",
            name="unique_project_build_number"
        ),
        Index(
            "idx_builds_project_id",
            "project_id"
        ),
    )

    # Relationships
    project = relationship(
        "Project",
        backref="builds",
        passive_deletes=True
    )
