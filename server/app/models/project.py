from sqlalchemy import Column, String, Integer, Text, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign Key
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    # Project Info -> created automatically by AI
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    slug = Column(String(255), unique=True, nullable=False)

    # Git Integration
    git_repo_url = Column(Text, nullable=True)
    git_branch = Column(String(100), default="main")

    # Project Configuration
    target_framework = Column(String(100), nullable=True)  # fastapi, flask, express
    target_language = Column(String(50), nullable=True)  # python, javascript, go

    # Status & Metadata
    status = Column(String(50), default="initializing")  # initializing, building, deployed

    # Deployment Info
    latest_deployed_url = Column(Text, nullable=True)
    last_deployed_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now()
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    # Statistics
    total_builds = Column(Integer, default=0)
    successful_builds = Column(Integer, default=0)
    failed_builds = Column(Integer, default=0)

    # Relationship
    user = relationship("User", backref="projects", passive_deletes=True)