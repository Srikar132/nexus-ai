"""
debug_artificer.py

Dry-run the Artificer node end-to-end WITHOUT touching the real database,
real Celery queue, or LangGraph checkpointing.

What this script does:
  1. Builds a minimal GraphState that mimics what conductor_node leaves behind
     after the user clicks "Approve Plan"
  2. Checks Docker is reachable
  3. Calls artificer_node() directly
  4. Prints every SSE event that would have been published to Redis

Run with:
  cd E:\\ALL-PROJECTS\\NexusAI\\server
  .\\venv\\Scripts\\activate
  python debug_artificer.py

Optional: override PLAN_OVERRIDE at the top to test a different tech stack.
"""

import json
import sys
import uuid
from unittest.mock import patch, MagicMock

# ── Intercept Redis publish so we can print locally ──────────────────────────
published_events: list[dict] = []

def mock_publish(project_id: str, event: dict):
    published_events.append(event)
    etype = event.get("type", "?")
    role  = event.get("role", "")
    if etype == "thinking":
        print(f"  💭 [{role}] {event.get('status', '')}")
    elif etype == "tool_call":
        print(f"  🔧 [{role}] tool={event.get('tool')}  input={event.get('input','')[:80]}")
    elif etype == "tool_result":
        result_preview = str(event.get('result', ''))[:120].replace('\n', ' ')
        print(f"       → {result_preview}")
    elif etype == "text_chunk":
        chunk = event.get("chunk", "")
        print(chunk, end="", flush=True)
    elif etype == "stage_change":
        print(f"\n  🔄 STAGE → {event.get('stage')}")
    elif etype == "agent_start":
        print(f"\n  ▶  AGENT START: {event.get('agent') or role}")
    elif etype == "agent_done":
        print(f"\n  ✅ AGENT DONE: {event.get('agent') or role}")
    else:
        print(f"  [{etype}] {event}")


# ── Patch Redis publish before importing the workflow ────────────────────────
with patch("app.core.redis.publish", side_effect=mock_publish):
    from app.agents.workflow import artificer_node

# ── The plan to test ─────────────────────────────────────────────────────────
# Change this to any plan you want to validate.

PLAN_OVERRIDE = {
    "status": "pending_approval",
    "overview": "A simple FastAPI health-check service with one GET /health endpoint",
    "tech_stack": {
        "language":  "python",
        "framework": "fastapi",
        "database":  "none",
    },
    "architecture": {
        "diagram":  "flowchart TD; A[Client] --> B[FastAPI /health]",
        "content":  "Single-file FastAPI app, no DB",
    },
    "database_schemas": {},
    "endpoints": [
        {"path": "/health", "method": "GET", "description": "Health check — returns {status: ok}"},
    ],
}

# ── Minimal GraphState that mimics post-approval state ───────────────────────
TEST_PROJECT_ID = "debug-project-" + str(uuid.uuid4())[:8]
TEST_BUILD_ID   = "debug-build-"   + str(uuid.uuid4())[:8]

state = {
    "project_id":         TEST_PROJECT_ID,
    "project_name":       "Debug Test App",
    "project_description": "Created by debug_artificer.py",
    "build_id":           TEST_BUILD_ID,
    "current_plan":       PLAN_OVERRIDE,
    "approved_plan":      PLAN_OVERRIDE,          # ← This is what conductor sets on approval
    "chat_history":       [],
    "current_user_input": None,
    "app_url":            None,
    "security_iteration": 0,
    "deploy_payload":     None,
    "artifacts":          [],
    "messages_to_save":   [],
    "repo_url":           None,
    "deploy_url":         None,
    "error":              None,
    "security_issues":    [],                     # empty = write mode (not fix mode)
}


def check_docker():
    """Verify Docker daemon is accessible before starting."""
    try:
        import docker as docker_sdk
        client = docker_sdk.from_env()
        client.ping()
        print("✅ Docker daemon is reachable")
        return True
    except Exception as e:
        print(f"❌ Docker is NOT reachable: {e}")
        print("   Start Docker Desktop and try again.")
        return False


def run():
    print("=" * 65)
    print("  ARTIFICER DEBUG SESSION")
    print("=" * 65)
    print(f"  project_id : {TEST_PROJECT_ID}")
    print(f"  build_id   : {TEST_BUILD_ID}")
    print(f"  tech_stack : {PLAN_OVERRIDE['tech_stack']}")
    print()

    # ── Pre-flight checks ─────────────────────────────────────────
    print("── Pre-flight checks ──────────────────────────────────────")
    if not check_docker():
        sys.exit(1)

    # ── Patch Redis publish for the actual run ────────────────────
    print("\n── Artificer node output ──────────────────────────────────")
    try:
        with patch("app.core.redis.publish", side_effect=mock_publish):
            result_state = artificer_node(state)

        print("\n\n── Results ─────────────────────────────────────────────────")
        print(f"  app_url       : {result_state.get('app_url')}")
        print(f"  messages saved: {len(result_state.get('messages_to_save', []))}")
        print(f"  artifacts     : {len(result_state.get('artifacts', []))}")
        print(f"  security_issues cleared: {result_state.get('security_issues') == []}")

        # ── Show tool call summary ────────────────────────────────
        tool_events = [e for e in published_events if e["type"] == "tool_call"]
        print(f"\n  Total tool calls: {len(tool_events)}")
        tool_counts: dict[str, int] = {}
        for e in tool_events:
            tool_counts[e["tool"]] = tool_counts.get(e["tool"], 0) + 1
        for tool, count in sorted(tool_counts.items(), key=lambda x: -x[1]):
            print(f"    {tool:20s} × {count}")

        # ── Verify container exists ───────────────────────────────
        print("\n── Docker container check ──────────────────────────────────")
        try:
            import docker as docker_sdk
            client = docker_sdk.from_env()
            container = client.containers.get(f"build-{TEST_BUILD_ID}")
            print(f"  Container status : {container.status}")
            print(f"  Container name   : {container.name}")

            # Quick health-check ping
            import subprocess
            host_port = None
            ports = container.ports
            for binding_list in ports.values():
                if binding_list:
                    host_port = binding_list[0]["HostPort"]
                    break
            if host_port:
                print(f"  Attempting health check on host port {host_port}...")
                import urllib.request, urllib.error
                try:
                    with urllib.request.urlopen(f"http://localhost:{host_port}/health", timeout=5) as r:
                        body = r.read().decode()
                        print(f"  ✅ /health → HTTP {r.status}  body={body[:100]}")
                except urllib.error.URLError as e:
                    print(f"  ⚠️  /health failed: {e.reason}")
            else:
                print("  ⚠️  No host port mapping found")

            # Offer to clean up
            print()
            answer = input("  Remove debug container? [y/N] ").strip().lower()
            if answer == "y":
                container.stop(timeout=5)
                container.remove(force=True)
                print("  🗑️  Container removed")
            else:
                print(f"  Container left running as: build-{TEST_BUILD_ID}")

        except Exception as e:
            print(f"  ❌ Container check failed: {e}")

        print("\n✅ DEBUG SESSION COMPLETE")

    except Exception as exc:
        print(f"\n❌ artificer_node raised an exception:\n")
        import traceback
        traceback.print_exc()
        print(f"\nPartial published events: {len(published_events)}")
        sys.exit(1)


if __name__ == "__main__":
    run()
