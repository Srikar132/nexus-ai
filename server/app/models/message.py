from sqlalchemy import Column, Text, TIMESTAMP, ForeignKey, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign Key
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False
    )

    # Who sent it
    role = Column(
        Text,
        nullable=False
    )

    # Type of message
    message_type = Column(
        Text,
        nullable=False
    )

   # JSONB blocks array (ordered, position-preserving)
   # For user/system messages this is just:
   # [{"type": "text", "content": "..."}]
   # For conductor messages it can have artifact blocks in between
    content = Column(JSONB, nullable=False, server_default="[]")

    # Optional artifact reference (FK can be added later when artifacts table exists)
    artifact_id = Column(UUID(as_uuid=True), nullable=True)

    # Machine-readable metadata (Postgres JSONB)
    # for system_event: machine-readable payload
    # e.g. { "event": "build_started", "build_id": "...", "build_number": 2 }
    # e.g. { "event": "deployment_complete", "url": "https://...", "build_id": "..." }
    # e.g. { "event": "build_failed", "reason": "...", "build_id": "..." }
    metadata = Column(JSONB, nullable=True)

    # Timestamp
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    # Table-level constraints
    __table_args__ = (
        CheckConstraint(
            "role IN ('user', 'conductor', 'system')",
            name="check_message_role"
        ),
        CheckConstraint(
            """
            message_type IN (
                'user_prompt',
                'plan_approval',
                'conductor_text',
                'conductor_plan',
                'system_event'
            )
            """,
            name="check_message_type"
        ),
        Index(
            "idx_messages_project_id_created",
            "project_id",
            "created_at".desc()
        ),
    )

    # Relationships
    project = relationship(
        "Project",
        backref="messages",
        passive_deletes=True
    )
    
    