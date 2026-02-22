# app/core/config.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Clerk (keeping for backward compatibility)
    CLERK_SECRET_KEY: Optional[str] = None
    CLERK_PUBLISHABLE_KEY: Optional[str] = None
    
    # NextAuth JWT
    NEXTAUTH_SECRET: str
    
    # Encryption for GitHub tokens
    ENCRYPTION_KEY: str
    
    # Database
    DATABASE_URL: str
    
    # Redis (optional)
    REDIS_URL: str = "redis://localhost:6379"
    
    # Celery (optional)
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    
    # Anthropic (optional)
    ANTHROPIC_API_KEY: Optional[str] = None
    
    class Config:
        env_file = ".env"

settings = Settings()