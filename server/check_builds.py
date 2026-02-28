"""Check builds for a specific project."""
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

PROJECT_ID = "d3a9d1e5-e138-4c12-95f2-b2128410f046"

with engine.connect() as conn:
    print("=== ALL builds for project ===")
    r = conn.execute(sqlalchemy.text(
        "SELECT id, build_number, status, deploy_url, repo_url, started_at, completed_at "
        "FROM builds WHERE project_id = :pid ORDER BY created_at DESC"
    ), {"pid": PROJECT_ID})
    rows = r.fetchall()
    if not rows:
        print("  (no builds found)")
    for row in rows:
        print(f"  id={row[0]}, build_number={row[1]}, status={row[2]}, "
              f"deploy_url={row[3]}, repo_url={row[4]}, "
              f"started_at={row[5]}, completed_at={row[6]}")

    print("\n=== LangGraph thread_id for project ===")
    r = conn.execute(sqlalchemy.text(
        "SELECT langgraph_thread_id, status FROM projects WHERE id = :pid"
    ), {"pid": PROJECT_ID})
    row = r.fetchone()
    if row:
        print(f"  thread_id={row[0]}, project_status={row[1]}")
    else:
        print("  (project not found)")

engine.dispose()
