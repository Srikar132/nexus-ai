"""
Drop ALL tables from the database so Alembic can start fresh.
Uses CASCADE to handle foreign key dependencies.
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def reset():
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(db_url)

    async with engine.begin() as conn:
        # Drop all tables using CASCADE (handles FK dependencies)
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        # Restore default grants
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))

    await engine.dispose()
    print("✅ All tables dropped. Database is clean.")

if __name__ == "__main__":
    asyncio.run(reset())
