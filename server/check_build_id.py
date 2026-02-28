"""Check if a specific build ID exists anywhere."""
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

BUILD_ID = "142daade-2556-463e-992e-e1a394c06c94"
PROJECT_ID = "d3a9d1e5-e138-4c12-95f2-b2128410f046"

with engine.connect() as conn:
    # Check for build by ID
    r = conn.execute(sqlalchemy.text("SELECT id, status FROM builds WHERE id = :bid"), {"bid": BUILD_ID})
    row = r.fetchone()
    print(f"Build by ID: {row}")

    # Check ALL builds (any project)
    r = conn.execute(sqlalchemy.text("SELECT id, project_id, status, build_number FROM builds ORDER BY created_at DESC LIMIT 10"))
    rows = r.fetchall()
    print(f"\nAll builds (latest 10):")
    for row in rows:
        print(f"  id={row[0]}, project={row[1]}, status={row[2]}, num={row[3]}")

    # Check if the project has messages (codebase was built = messages exist)
    r = conn.execute(sqlalchemy.text(
        "SELECT COUNT(*), array_agg(DISTINCT role) FROM messages WHERE project_id = :pid"
    ), {"pid": PROJECT_ID})
    row = r.fetchone()
    print(f"\nMessages for project: count={row[0]}, roles={row[1]}")

engine.dispose()
