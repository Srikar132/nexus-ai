from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession
)
from sqlalchemy.orm import declarative_base
from app.core.config import settings    
# Dependency for FastAPI routes
from typing import AsyncGenerator


# Convert to async driver
DATABASE_URL =  settings.DATABASE_URL.replace(
    "postgresql://",
    "postgresql+asyncpg://"
)

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=True,  # disable in production
    pool_size=10,  # Number of connections to keep in the pool
    max_overflow=20,  # Max connections beyond pool_size
    pool_pre_ping=True,  # Verify connections before using them
    pool_recycle=3600,  # Recycle connections after 1 hour
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
    autoflush=False,
    autocommit=False,
)

# Base class for models
Base = declarative_base()

# Import models here so SQLAlchemy knows about them
from app.models import user  # noqa: E402

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    print("✅ Database tables created successfully!")

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session