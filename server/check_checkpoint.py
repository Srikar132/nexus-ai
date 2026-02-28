"""Check LangGraph checkpoint state for a thread."""
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
engine = sqlalchemy.create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 15})

THREAD_ID = "39dfe85e-da1b-442a-bdc6-2c86bef4e166"

with engine.connect() as conn:
    # Check checkpoint tables
    print("=== Checking checkpoint tables ===")
    for table in ['checkpoints', 'checkpoint_blobs', 'checkpoint_writes']:
        r = conn.execute(sqlalchemy.text(
            f"SELECT COUNT(*) FROM {table} WHERE thread_id = :tid"
        ), {"tid": THREAD_ID})
        count = r.scalar()
        print(f"  {table}: {count} rows")

    # Get the latest checkpoint metadata
    print("\n=== Latest checkpoint ===")
    r = conn.execute(sqlalchemy.text("""
        SELECT thread_id, checkpoint_id, parent_checkpoint_id, metadata
        FROM checkpoints 
        WHERE thread_id = :tid 
        ORDER BY checkpoint_id DESC 
        LIMIT 1
    """), {"tid": THREAD_ID})
    row = r.fetchone()
    if row:
        import json
        meta = row[3] if row[3] else "{}"
        if isinstance(meta, str):
            meta = json.loads(meta)
        print(f"  checkpoint_id: {row[1]}")
        print(f"  parent: {row[2]}")
        print(f"  metadata: {json.dumps(meta, indent=2)[:500]}")
    else:
        print("  (no checkpoints found)")

engine.dispose()
