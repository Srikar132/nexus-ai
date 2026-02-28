"""Fix stale alembic_version in DB, then run upgrade."""
from sqlalchemy import create_engine, text
from app.core.config import settings

db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
# Fix SSL param for psycopg2
db_url = db_url.replace("?ssl=require", "?sslmode=require").replace("&ssl=require", "&sslmode=require")
engine = create_engine(db_url)

with engine.connect() as conn:
    conn.execute(text("UPDATE alembic_version SET version_num = 'bf9af9f94147'"))
    conn.commit()
    print("Stamped alembic_version to bf9af9f94147")

engine.dispose()
