"""
agents/workflow.py

3-Agent LangGraph pipeline.

AGENTS:
  Conductor  — Chat or trigger build (LLM tool-calling)
  Artificer  — ReAct agent. Writes + tests code in Docker.
  Deployer   — Fetches credentials from DB, pushes to GitHub, deploys to Railway.

FLOW:
  START → conductor (interrupt_before) →
    chat  → back to conductor
    build → artificer → deployer → END

KEY POINTS:
  1. interrupt_before=["conductor"] only — deployer runs automatically
     after artificer completes.
  2. Deployer fetches github_token_encrypted / railway_api_key_encrypted
     from the User record and decrypts them in-node. No payload injection needed.
  3. run_config registered by emit_run_config tool on DockerManager.
  4. Env vars are skipped entirely for now.
"""

from __future__ import annotations

import json
import logging
import uuid
from operator import add as _list_add
from typing import Annotated, Optional, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.checkpoint.postgres import PostgresSaver

from app.core.redis import publish
from app.core.config import settings
from app.core.docker_manager import DockerManager, RunConfig
from app.core.llm import get_llm
from app.agents.tools.docker_tools import get_docker_tools
from app.agents.tools.deploy_tools import get_deploy_tools
from app.agents.react import run_react_agent
from app.schemas.enums import WorkflowStage

log = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
# GRAPH STATE
# ═══════════════════════════════════════════════════════════════════

class GraphState(TypedDict, total=False):
    # Identity
    project_id:             str
    build_id:               Optional[str]
    project_name:           str
    project_description:    str
    user_id:                str               # Needed by deployer to fetch credentials

    # Chat
    chat_history:           Annotated[list, _list_add]
    current_user_input:     Optional[dict]    # {"message": str, "message_type": str}

    # Build control
    build_requested:        bool
    build_description:      str
    tech_stack_hint:        Optional[dict]

    # Container / app
    run_config:             Optional[dict]    # RunConfig.to_dict() — serialisable
    app_url:                Optional[str]

    # Persistence
    artifacts:              list
    messages_to_save:       Annotated[list, _list_add]

    # Results
    repo_url:               Optional[str]
    deploy_url:             Optional[str]
    error:                  Optional[str]


# ═══════════════════════════════════════════════════════════════════
# SHARED HELPERS
# ═══════════════════════════════════════════════════════════════════

def _thinking(project_id: str, msg: str, role: str = "system") -> None:
    publish(project_id, {"type": "thinking", "status": msg, "role": role})


def _stream_text(project_id: str, text: str, role: str) -> None:
    publish(project_id, {"type": "agent_start", "role": role})
    words = text.split(" ")
    for i, word in enumerate(words):
        publish(project_id, {
            "type":  "text_chunk",
            "chunk": word + (" " if i < len(words) - 1 else ""),
            "role":  role,
        })
    publish(project_id, {"type": "agent_done", "role": role})


def _msg(role: str, message_type: str, text: str) -> dict:
    return {
        "role":         role,
        "message_type": message_type,
        "content":      [{"type": "text", "content": text}],
    }


def _get_user_credentials(user_id: str) -> tuple[str, str]:
    """
    Fetch and decrypt github_token + railway_api_key from the User record.
    Returns (github_token, railway_api_key) — empty strings if missing.
    """
    from sqlalchemy import select, create_engine
    from sqlalchemy.orm import sessionmaker
    from app.models.user import User
    from app.utils.encryption import decrypt_token

    db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    # psycopg2 uses "sslmode=require", not "ssl=require" (Neon sends the latter)
    db_url = db_url.replace("?ssl=require", "?sslmode=require")
    db_url = db_url.replace("&ssl=require", "&sslmode=require")
    db_url = db_url.replace("?ssl=true", "?sslmode=require")
    db_url = db_url.replace("&ssl=true", "&sslmode=require")
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        user = db.execute(
            select(User).where(User.id == uuid.UUID(user_id))
        ).scalar_one_or_none()

        if not user:
            log.error("User not found: %s", user_id)
            return "", ""

        github_token    = decrypt_token(user.github_token_encrypted or "")
        railway_api_key = decrypt_token(user.railway_api_key_encrypted or "")
        return github_token, railway_api_key

    except Exception as e:
        log.exception("Failed to fetch credentials for user %s: %s", user_id, e)
        return "", ""
    finally:
        db.close()
        engine.dispose()

model = "gpt-4o"

# ═══════════════════════════════════════════════════════════════════
# NODE 1 — CONDUCTOR
# ═══════════════════════════════════════════════════════════════════

CONDUCTOR_SYSTEM = """\
You are Conductor, the orchestrating AI for a server-building platform called NexusAI.

Analyse the user's message and call EXACTLY ONE of the two tools:

• start_build     — user wants to create/build something (app, API, website, tool, script, etc.)
• respond_to_user — everything else (questions, chat, unclear intent → ask a clarifying question)

Project context:
  Name:        {project_name}
  Description: {project_description}

Rules:
- Always call exactly one tool. Never reply with raw text.
- For start_build: include ALL details the user mentioned. Add sensible defaults but
  do NOT invent requirements the user didn't ask for.
- If the intent is ambiguous, use respond_to_user to ask one focused clarifying question.
- Only respond correctly for backend-related user queries.
- If asked out of scope, politely decline and suggest focusing on backend topics.
- Normal conversation about backend topics is welcome.
"""

_CONDUCTOR_TOOLS = [
    {
        "name": "start_build",
        "description": "Start building an application. Call when the user wants to create something.",
        "parameters": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "Detailed description of what to build.",
                },
                "tech_stack": {
                    "type": "object",
                    "description": "Optional tech stack (only what the user specified).",
                    "properties": {
                        "language":  {"type": "string"},
                        "framework": {"type": "string"},
                        "database":  {"type": "string"},
                    },
                },
            },
            "required": ["description"],
        },
    },
    {
        "name": "respond_to_user",
        "description": "Send a text response. Use for chat, questions, clarifications.",
        "parameters": {
            "type": "object",
            "properties": {
                "message": {"type": "string", "description": "The response to send."},
            },
            "required": ["message"],
        },
    },
]


def conductor_node(state: GraphState) -> dict:
    project_id = state["project_id"]
    user_input = state.get("current_user_input")

    if not user_input:
        return {"current_user_input": None}

    user_message = user_input.get("message", "")
    _thinking(project_id, "Analysing your request...", "conductor")

    system = CONDUCTOR_SYSTEM.format(
        project_name        = state.get("project_name", "Untitled"),
        project_description = state.get("project_description", ""),
    )

    messages = [{"role": "system", "content": system}]
    for msg in state.get("chat_history", [])[-20:]:
        if isinstance(msg, dict):
            messages.append(msg)
    messages.append({"role": "user", "content": user_message})

    llm      = get_llm(model)
    response = llm.chat_with_tools(messages, _CONDUCTOR_TOOLS, max_tokens=2048, temperature=0)

    if not response.tool_calls:
        text = response.content or "Could you tell me more about what you'd like to build?"
        _stream_text(project_id, text, "conductor")
        publish(project_id, {"type": "stage_change", "stage": WorkflowStage.IDLE.value})
        publish(project_id, {"type": "done"})
        return {
            "build_requested":    False,
            "current_user_input": None,
            "chat_history": [
                {"role": "user",      "content": user_message},
                {"role": "assistant", "content": text},
            ],
            "messages_to_save": [_msg("conductor", "assistant_response", text)],
        }

    tc        = response.tool_calls[0]
    tool_name = tc["name"]
    tool_args = tc["args"]

    if tool_name == "start_build":
        description = tool_args.get("description", user_message)
        tech_stack  = tool_args.get("tech_stack")

        ack = (
            f"🚀 Got it! Building:\n\n{description}\n\n"
            "Handing off to the Artificer agent now..."
        )
        _stream_text(project_id, ack, "conductor")
        publish(project_id, {"type": "stage_change", "stage": WorkflowStage.BUILDING.value})
        publish(project_id, {"type": "done"})

        return {
            "build_requested":    True,
            "build_description":  description,
            "tech_stack_hint":    tech_stack,
            "current_user_input": None,
            "chat_history": [
                {"role": "user",      "content": user_message},
                {"role": "assistant", "content": ack},
            ],
            "messages_to_save": [_msg("conductor", "assistant_response", ack)],
        }

    # respond_to_user
    text = tool_args.get("message", "")
    _stream_text(project_id, text, "conductor")
    publish(project_id, {"type": "stage_change", "stage": WorkflowStage.IDLE.value})
    publish(project_id, {"type": "done"})

    return {
        "build_requested":    False,
        "current_user_input": None,
        "chat_history": [
            {"role": "user",      "content": user_message},
            {"role": "assistant", "content": text},
        ],
        "messages_to_save": [_msg("conductor", "assistant_response", text)],
    }


def route_after_conductor(state: GraphState) -> str:
    if state.get("build_requested"):
        return "artificer"
    return "conductor"   # loop back → interrupt_before parks here


# ═══════════════════════════════════════════════════════════════════
# NODE 2 — ARTIFICER
# ═══════════════════════════════════════════════════════════════════

_ARTIFICER_SYSTEM = """\
You are Artificer, an expert software engineer AI agent.

Build a complete, production-quality application inside a Docker container at /workspace.

BUILD DESCRIPTION:
{build_description}

{tech_stack_section}

RULES:
1. Write ALL files needed for a complete, working application.
2. Start with dependency files (requirements.txt / package.json), then source, then config.
3. Always write COMPLETE files — never partial or placeholder content.
4. After writing files, install dependencies with exec_command.
5. Run check_syntax on every Python/JS file you write.
6. The app MUST listen on port 8080 (the PORT env var is already set to 8080).
7. Include a health check endpoint at /health returning HTTP 200.
8. Write a Dockerfile.
9. Use best practices: error handling, input validation, no hardcoded secrets.

SWAGGER / API DOCUMENTATION:
Always integrate Swagger/OpenAPI documentation so all endpoints are browsable
at /docs (FastAPI includes this by default; for Express use swagger-ui-express;
for other frameworks use the idiomatic equivalent).

MANDATORY FINAL STEP — emit_run_config:
After all files are written, dependencies installed, and syntax checked, you
MUST call `emit_run_config` with:
  - install_command:    the command to install dependencies
  - start_command:      the command to start the application
  - health_check_path:  the HTTP path that returns 200 when ready
  - startup_wait_secs:  seconds to wait before health-checking

⚠️ WITHOUT CALLING emit_run_config, YOUR APPLICATION CANNOT BE DEPLOYED ⚠️
"""


def artificer_node(state: GraphState) -> dict:
    project_id        = state["project_id"]
    build_id          = state.get("build_id") or str(uuid.uuid4())
    build_description = state.get("build_description", "")
    tech_stack_hint   = state.get("tech_stack_hint")

    if not project_id:
        error_msg = "Invalid project_id provided to artificer_node"
        log.error(error_msg)
        return {"error": error_msg, "messages_to_save": [_msg("artificer", "assistant_response", f"❌ {error_msg}")]}

    if not build_description or len(build_description.strip()) < 10:
        log.warning("Very short or empty build description for project=%s", project_id)
        build_description = build_description or "Build a simple web application with basic functionality."

    _thinking(project_id, "Preparing build environment...", "artificer")
    publish(project_id, {"type": "stage_change", "stage": WorkflowStage.BUILDING.value})

    tech_section = ""
    if tech_stack_hint:
        parts = [
            f"- {k.title()}: {v}"
            for k, v in tech_stack_hint.items()
            if v and str(v).strip()
        ]
        if parts:
            tech_section = "REQUESTED TECH STACK:\n" + "\n".join(parts)

    system_prompt = _ARTIFICER_SYSTEM.format(
        build_description  = build_description,
        tech_stack_section = tech_section,
    )

    docker = DockerManager(project_id, build_id)

    try:
        _thinking(project_id, "Starting Docker container...", "artificer")

        try:
            docker.spin_up()
        except Exception as docker_error:
            if "Cannot connect to the Docker daemon" in str(docker_error):
                error_msg = "Docker daemon is not running. Please start Docker Desktop and try again."
            elif "permission denied" in str(docker_error).lower():
                error_msg = "Docker permission denied. Please check Docker daemon permissions."
            else:
                error_msg = f"Failed to start Docker container: {docker_error}"

            log.error("Docker startup failed for project=%s: %s", project_id, error_msg)
            publish(project_id, {"type": "text_chunk", "chunk": f"❌ {error_msg}\n", "role": "artificer"})
            return {
                "build_id": build_id,
                "error":    error_msg,
                "messages_to_save": [_msg("artificer", "assistant_response", f"❌ {error_msg}")],
            }

        tools = get_docker_tools(docker)

        publish(project_id, {"type": "agent_start", "role": "artificer"})
        _thinking(project_id, "Writing code...", "artificer")

        try:
            final_text, _tool_log = run_react_agent(
                project_id  = project_id,
                role        = "artificer",
                system      = system_prompt,
                user_prompt = f"Build this application:\n\n{build_description}",
                tools       = tools,
                max_iter    = 25,
                model       = model,
            )
        except Exception as agent_error:
            log.error("React agent failed for project=%s: %s", project_id, agent_error)
            error_msg = f"Agent execution failed: {agent_error}"
            try:
                docker.spin_down()
            except Exception:
                pass
            return {
                "build_id": build_id,
                "error":    error_msg,
                "messages_to_save": [_msg("artificer", "assistant_response", f"❌ {error_msg}")],
            }

        publish(project_id, {"type": "agent_done", "role": "artificer"})

        run_config_dict = getattr(docker, "_run_config_from_tool", None)
        app_url         = None
        run_config_obj  = None

        if run_config_dict:
            try:
                run_config_obj = RunConfig.from_dict(run_config_dict, tech_stack_hint)

                try:
                    docker.configure_run(run_config_obj)
                except Exception as config_error:
                    log.warning("Docker configure_run failed for project=%s: %s", project_id, config_error)

                _thinking(project_id, "Starting application...", "artificer")

                try:
                    app_url = docker.start_app()
                    if app_url:
                        log.info("App started at %s project=%s", app_url, project_id)
                except Exception as start_error:
                    log.warning("Failed to start app for project=%s: %s", project_id, start_error)
                    publish(project_id, {
                        "type":  "text_chunk",
                        "chunk": f"⚠️ App built but failed to start locally: {start_error}\n",
                        "role":  "artificer",
                    })

            except Exception as run_config_error:
                log.warning("RunConfig creation failed for project=%s: %s", project_id, run_config_error)
                publish(project_id, {
                    "type":  "text_chunk",
                    "chunk": f"⚠️ Invalid run configuration: {run_config_error}\n",
                    "role":  "artificer",
                })
        else:
            log.warning("Agent did not call emit_run_config for project=%s", project_id)
            publish(project_id, {
                "type":  "text_chunk",
                "chunk": "⚠️ Agent did not register a run configuration. Deployer will proceed with source as-is.\n",
                "role":  "artificer",
            })

        publish(project_id, {
            "type":  "text_chunk",
            "chunk": "✅ Build complete! Starting deployment...\n",
            "role":  "artificer",
        })

        return {
            "build_id":         build_id,
            "run_config":       run_config_obj.to_dict() if run_config_obj else None,
            "app_url":          app_url,
            "messages_to_save": [_msg("artificer", "assistant_response", final_text or "Build complete.")],
        }

    except Exception as e:
        log.exception("Artificer failed project=%s", project_id)
        error_message = f"Build error: {e}"

        try:
            docker.spin_down()
        except Exception:
            pass

        publish(project_id, {
            "type":  "text_chunk",
            "chunk": f"\n❌ {error_message}\n",
            "role":  "artificer",
        })

        return {
            "build_id": build_id,
            "error":    error_message,
            "messages_to_save": [_msg("artificer", "assistant_response", f"❌ Build failed: {error_message}")],
        }


# ═══════════════════════════════════════════════════════════════════
# NODE 3 — DEPLOYER
# Runs automatically after artificer. Fetches credentials from DB.
# ═══════════════════════════════════════════════════════════════════

_DEPLOYER_SYSTEM = """\
You are Deployer. Deploy the application to Railway via GitHub.

Steps (in order):
1. create_github_repo — create a private repo named "{repo_name}"
2. push_to_github     — push /workspace to the repo (use the clone_url from step 1)
3. deploy_to_railway  — deploy the repo to Railway (use the html_url from step 1)
4. wait_for_deploy    — poll until the deployment is live or failed
5. Report the final live URL clearly

Project name: {project_name}
Build description: {build_description}
"""


def deployer_node(state: GraphState) -> dict:
    project_id      = state["project_id"]
    build_id        = state.get("build_id", "")
    user_id         = state.get("user_id", "")
    run_config_dict = state.get("run_config")

    _thinking(project_id, "Fetching deployment credentials...", "deployer")
    publish(project_id, {"type": "stage_change", "stage": WorkflowStage.DEPLOYING.value})

    # ── Fetch credentials from DB ──────────────────────────────────
    if not user_id:
        error_msg = "No user_id in state — cannot fetch deployment credentials."
        log.error(error_msg)
        publish(project_id, {"type": "text_chunk", "chunk": f"❌ {error_msg}\n", "role": "deployer"})
        publish(project_id, {"type": "done"})
        return {"error": error_msg, "messages_to_save": [_msg("deployer", "assistant_response", f"❌ {error_msg}")]}

    github_token, railway_api_key = _get_user_credentials(user_id)
    
    print(f"GITHUB TOKEN : {github_token[:4]}... RAILWAY KEY: {railway_api_key[:4]}...")

    if not github_token:
        error_msg = "GitHub token not found. Please connect your GitHub account in settings."
        log.error("Missing github_token for user=%s project=%s", user_id, project_id)
        publish(project_id, {"type": "text_chunk", "chunk": f"❌ {error_msg}\n", "role": "deployer"})
        publish(project_id, {"type": "done"})
        return {"error": error_msg, "messages_to_save": [_msg("deployer", "assistant_response", f"❌ {error_msg}")]}

    if not railway_api_key:
        error_msg = "Railway API key not found. Please add your Railway API key in settings."
        log.error("Missing railway_api_key for user=%s project=%s", user_id, project_id)
        publish(project_id, {"type": "text_chunk", "chunk": f"❌ {error_msg}\n", "role": "deployer"})
        publish(project_id, {"type": "done"})
        return {"error": error_msg, "messages_to_save": [_msg("deployer", "assistant_response", f"❌ {error_msg}")]}

    # ── Reattach Docker container ──────────────────────────────────
    docker = DockerManager.reattach(
        project_id = project_id,
        build_id   = build_id,
        run_config = run_config_dict,
    )

    tools = get_deploy_tools(docker, github_token, railway_api_key=railway_api_key)

    project_name = state.get("project_name", "nexus-app")
    repo_name    = project_name.lower().replace(" ", "-")[:40]

    system = _DEPLOYER_SYSTEM.format(
        project_name      = project_name,
        repo_name         = repo_name,
        build_description = state.get("build_description", ""),
    )

    publish(project_id, {"type": "agent_start", "role": "deployer"})
    _thinking(project_id, "Deploying to Railway...", "deployer")

    final_text, tool_log = run_react_agent(
        project_id  = project_id,
        role        = "deployer",
        system      = system,
        user_prompt = "Deploy the application now. No environment variables needed.",
        tools       = tools,
        max_iter    = 15,
        model       = model,
    )

    publish(project_id, {"type": "agent_done", "role": "deployer"})

    repo_url   = _extract_url(tool_log, "github.com")
    deploy_url = _extract_url(tool_log, "railway.app") or _extract_url(tool_log, "up.railway.app")

    publish(project_id, {"type": "stage_change", "stage": WorkflowStage.COMPLETE.value})
    publish(project_id, {"type": "done", "deploy_url": deploy_url, "repo_url": repo_url})

    try:
        docker.spin_down()
    except Exception:
        pass

    return {
        "repo_url":         repo_url,
        "deploy_url":       deploy_url,
        "messages_to_save": [_msg("deployer", "assistant_response", final_text or "Deployment complete.")],
    }


def _extract_url(tool_log: list, domain: str) -> str | None:
    import re
    pattern = re.compile(r"https?://[^\s'\"]*" + re.escape(domain) + r"[^\s'\"]*")
    for entry in tool_log:
        match = pattern.search(entry.get("output", ""))
        if match:
            return match.group(0)
    return None


# ═══════════════════════════════════════════════════════════════════
# CHECKPOINTER FACTORY
# ═══════════════════════════════════════════════════════════════════

def _make_checkpointer(db_url: str) -> PostgresSaver:
    """
    Create a long-lived PostgresSaver for use in a Celery worker process.

    Uses a raw psycopg connection with autocommit=True (required by LangGraph).
    Avoids PostgresSaver.from_conn_string() which is a context manager and
    will silently close the connection when GC runs in long-lived workers.
    """
    import psycopg
    conn = psycopg.connect(db_url, autocommit=True)
    checkpointer = PostgresSaver(conn)
    checkpointer.setup()
    return checkpointer


# ═══════════════════════════════════════════════════════════════════
# GRAPH COMPILATION
# ═══════════════════════════════════════════════════════════════════

def create_workflow(db_url: str | None = None):
    """
    Compile and return the LangGraph workflow.

    Flow:
      START → conductor → artificer → deployer → END

    Interrupt strategy:
      interrupt_before=["conductor"]  — park between user messages only
      Deployer runs automatically after Artificer (no interrupt).
    """
    graph = StateGraph(GraphState)

    graph.add_node("conductor", conductor_node)
    graph.add_node("artificer", artificer_node)
    graph.add_node("deployer",  deployer_node)

    graph.add_edge(START, "conductor")

    graph.add_conditional_edges("conductor", route_after_conductor, {
        "artificer": "artificer",
        "conductor": "conductor",
    })

    # Straight line: artificer → deployer → done
    graph.add_edge("artificer", "deployer")
    graph.add_edge("deployer",  END)

    checkpointer = _make_checkpointer(db_url) if db_url else __import__(
        "langgraph.checkpoint.memory", fromlist=["MemorySaver"]
    ).MemorySaver()

    return graph.compile(
        checkpointer     = checkpointer,
        interrupt_before = ["conductor"],   # Only conductor is interrupted
    )
    