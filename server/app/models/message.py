from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
import uuid

from app.core.database import Base


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"))
    
    # Who sent it: user | conductor | artificer | guardian | system
    role: Mapped[str] = mapped_column(String, nullable=False)
    
    # Type of message
    message_type: Mapped[str] = mapped_column(String, nullable=False)
    
    # JSONB blocks: [{"type":"text","content":"..."},{"type":"artifact","artifact_id":"uuid"}]
    content: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    
    # Machine-readable metadata (Postgres JSONB)
    # for system_event: machine-readable payload
    # e.g. { "event": "build_started", "build_id": "...", "build_number": 2 }
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="messages")
    
    