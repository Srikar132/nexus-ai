from sqlalchemy import Column, String, Integer, TIMESTAMP, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.core.database import Base




class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    github_id = Column(String(255), unique=True, nullable=False)
    email = Column(String(255), nullable=True)
    username = Column(String(100), nullable=False)
    
    # Store encrypted GitHub token for future API calls
    github_token_encrypted = Column(Text, nullable=True)

    # user's preferences
    preferred_stack = Column(String(100), nullable=True)        # -- nextjs, fastapi, node, etc.
    preferred_language = Column(String(50), nullable=True)      # -- python, typescript
    developer_level = Column(String(50), default='beginner')    # -- beginner, intermediate, advanced, founder
    
    #Tracking user onboarding status
    onboarding_completed = Column(Integer, default=0)  # 0 = not completed, 1 = completed

    subscription_tier = Column(String(50), default="free")

    monthly_builds_used = Column(Integer, default=0)
    monthly_builds_limit = Column(Integer, default=3)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    last_active_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )