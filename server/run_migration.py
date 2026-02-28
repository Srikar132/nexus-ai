"""
Quick script to run alembic upgrade and check status.
Handles the SSL fix for Neon/Supabase databases.
"""
import sqlalchemy
from app.core.config import settings

def fix_ssl(url: str) -> str:
    return (
        url
        .replace("postgresql+asyncpg://", "postgresql://")
        .replace("?ssl=require", "?sslmode=require")
        .replace("&ssl=require", "&sslmode=require")
    )

url = fix_ssl(settings.DATABASE_URL)
print(f"Connecting to DB...")
engine = sqlalchemy.create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 15})

with engine.connect() as conn:
    print("Connected!")
    
    # Check current version
    r = conn.execute(sqlalchemy.text("SELECT version_num FROM alembic_version"))
    rows = [row[0] for row in r]
    print(f"Current alembic version: {rows}")

    # Check if metadata column exists on builds
    r = conn.execute(sqlalchemy.text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'builds' 
        ORDER BY ordinal_position
    """))
    cols = [row[0] for row in r]
    print(f"Builds columns: {cols}")

    # Check if raw_plan still exists
    if 'raw_plan' in cols:
        print("WARNING: raw_plan column still exists — migration not applied yet")
    else:
        print("OK: raw_plan column removed")
    if 'metadata' in cols:
        print("OK: metadata column exists")
    else:
        print("WARNING: metadata column missing — migration not applied yet")

engine.dispose()
print("Done.")
