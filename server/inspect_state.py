"""Inspect LangGraph state for the stuck project."""
import sys
sys.path.insert(0, ".")

from app.core.config import settings

def fix_ssl(url: str) -> str:
    return (
        url
        .replace("postgresql+asyncpg://", "postgresql://")
        .replace("?ssl=require", "?sslmode=require")
        .replace("&ssl=require", "&sslmode=require")
    )

THREAD_ID = "39dfe85e-da1b-442a-bdc6-2c86bef4e166"

db_url = fix_ssl(settings.DATABASE_URL)

import psycopg
conn = psycopg.connect(db_url, autocommit=True)

from langgraph.checkpoint.postgres import PostgresSaver
checkpointer = PostgresSaver(conn)
checkpointer.setup()

from app.agents.workflow import create_workflow
# Use memory saver for the graph since we just need to read state from postgres checkpointer
from langgraph.graph import StateGraph

# Actually, let's just use the checkpointer directly to get the state
config = {"configurable": {"thread_id": THREAD_ID}}

# Get the checkpoint tuple
checkpoint_tuple = checkpointer.get_tuple(config)
if checkpoint_tuple is None:
    print("No checkpoint found for this thread!")
    sys.exit(1)

checkpoint = checkpoint_tuple.checkpoint
metadata = checkpoint_tuple.metadata

print("=== Checkpoint Metadata ===")
print(f"  step: {metadata.get('step')}")
print(f"  source: {metadata.get('source')}")

# The channel_values contain the graph state
channel_values = checkpoint.get("channel_values", {})
print("\n=== Key State Values ===")
print(f"  project_id: {channel_values.get('project_id')}")
print(f"  build_id: {channel_values.get('build_id')}")
print(f"  build_requested: {channel_values.get('build_requested')}")
print(f"  build_description: {channel_values.get('build_description', '')[:100]}")
print(f"  project_name: {channel_values.get('project_name')}")
print(f"  error: {channel_values.get('error')}")
print(f"  deploy_url: {channel_values.get('deploy_url')}")
print(f"  repo_url: {channel_values.get('repo_url')}")
print(f"  deploy_payload present: {channel_values.get('deploy_payload') is not None}")
print(f"  run_config present: {channel_values.get('run_config') is not None}")

# Check pending_sends (this tells us what node is next)
pending = checkpoint_tuple.pending_writes or []
print(f"\n=== Pending Writes ({len(pending)}) ===")
for pw in pending:
    print(f"  {pw}")

# Check the tasks
print(f"\n=== Checkpoint Config ===")
print(f"  thread_id: {checkpoint_tuple.config.get('configurable', {}).get('thread_id')}")

conn.close()
print("\nDone.")
