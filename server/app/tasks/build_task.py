"""
workers/build_worker.py

CREDENTIAL ASSEMBLY HAPPENS HERE — not in the graph nodes.
Workers have natural DB access. Graph nodes should not.

TASKS:

  start_workflow_task   — first message, starts LangGraph thread

  resume_workflow_task  — every subsequent chat/approval message

  railway_connect_task  — user just saved their Railway key via POST /account/railway-key
                          Worker checks: is a build currently waiting for Railway key?
                          YES → assemble deploy_payload (no env vars yet), resume graph
                          Graph → deployer node sees railway_connected=True → skips Railway step → emits env_var_request

  deploy_confirm_task   — user submitted plaintext app env vars
                          Worker assembles FULL deploy_payload:
                            plaintext_vars   = from request body
                            github_token     = decrypt from user.github_token_encrypted
                            railway_api_key  = decrypt from user.railway_api_key_encrypted
                          → resumes graph → deployer runs Railway deploy

RAILWAY KEY CHECK:
  Happens in deploy_confirm_task BEFORE resuming the graph.
  If railway_api_key_encrypted is NULL:
    → publish connect_railway event directly via Redis (no graph resume)
    → frontend shows the inline connect_railway card
    → user pastes key → POST /account/railway-key → railway_connect_task
    → resumes graph with railway_connected signal
    → deployer skips to env_var_request
"""
import logging
from datetime import datetime
from celery import Celery
from langgraph.types import Command
from app.core.config import settings
from app.schemas.enums import MessageType
# from app.models import User, Project, Build, Message, Artifact

log = logging.getLogger(__name__)


celery_app = Celery("aibuild", broker=settings.REDIS_URL, backend=settings.REDIS_URL)
celery_app.conf.update(
    task_serializer            = "json",
    result_serializer          = "json",
    accept_content             = ["json"],
    timezone                   = "UTC",
    task_track_started         = True,
    task_acks_late             = True,
    task_reject_on_worker_lost = True,
    worker_prefetch_multiplier = 1,   # one task at a time per worker (builds are heavy)
)

# ── Internal helpers ──────────────────────────────────────────────

def _fix_ssl_param(url: str) -> str:
    """
    Neon/Supabase URLs use ``?ssl=require`` which asyncpg understands,
    but psycopg2 and psycopg (libpq) do NOT.
    Replace ``ssl=require`` → ``sslmode=require`` so sync drivers work.
    """
    return (
        url
        .replace("?ssl=require", "?sslmode=require")
        .replace("&ssl=require", "&sslmode=require")
    )


def _workflow():
    from app.agents.workflow import create_workflow
    return create_workflow(_fix_ssl_param(settings.DATABASE_URL))


def _db():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    return sessionmaker(create_engine(_fix_ssl_param(settings.DATABASE_URL)))()

def _get_user(db, user_id: str):
    from app.models import User
    return db.get(User, user_id)


# def _get_project(db, project_id: str):
#     from app.models import Project
#     return db.get(Project, project_id)



def _create_build(db, project_id: str, approved_plan: dict) -> str:
    """Create a Build row and return its ID string."""
    from sqlalchemy import select, func
    from app.models import Build
    result     = db.execute(
        select(func.coalesce(func.max(Build.build_number), 0))
        .where(Build.project_id == project_id)
    )
    next_num   = result.scalar_one() + 1
    build      = Build(
        project_id    = project_id,
        build_number  = next_num,
        status        = "approved",
        approved_plan = approved_plan,
        started_at    = datetime.utcnow(),
    )
    db.add(build)
    db.flush()
    db.commit()
    return str(build.id)


def _save_state_to_db(db, state: dict, project_id: str, build_id: str | None):
    """
    Persist messages + artifacts accumulated during one graph run.
    Replaces temp artifact IDs with real DB UUIDs inside message blocks.
    Clears artifacts/messages_to_save from state so they aren't double-saved.
    NEVER persists deploy_payload (contains plaintext credentials).
    """
    from app.models import Message, Artifact

    temp_to_real: dict[str, str] = {}

    for art in state.get("artifacts", []):
        temp_id = art.get("temp_id")
        if not temp_id:
            continue
        row = Artifact(
            project_id    = project_id,
            build_id      = build_id,
            artifact_type = art.get("artifact_type", "unknown"),
            title         = art.get("title", "Artifact"),
            content       = art.get("content", {}),
        )
        db.add(row)
        db.flush()
        temp_to_real[temp_id] = str(row.id)

    for msg in state.get("messages_to_save", []):
        real_blocks = []
        for block in msg.get("content", []):
            if block.get("type") == "artifact" and block.get("artifact_id") in temp_to_real:
                real_blocks.append({"type": "artifact", "artifact_id": temp_to_real[block["artifact_id"]]})
            else:
                real_blocks.append(block)
        db.add(Message(
            project_id    = project_id,
            role          = msg["role"],
            message_type  = msg["message_type"],
            content       = real_blocks,
            metadata_     = msg.get("metadata"),
        ))

    db.commit()

    # Clear so next run doesn't re-save
    state["artifacts"]        = []
    state["messages_to_save"] = []
    return state


def _finalise_build(db, state: dict):
    """Update Build + Project rows when graph reaches END."""
    from app.models import Project, Build

    build_id   = state.get("build_id")
    deploy_url = state.get("deploy_url")
    repo_url   = state.get("repo_url")

    if build_id:
        build = db.get(Build, build_id)
        if build:
            build.status                = "failed" if state.get("error") else "completed"
            build.deploy_url            = deploy_url
            build.repo_url              = repo_url
            build.security_iteration    = state.get("security_iteration", 0)
            build.security_issues_found = state.get("all_security_issues", [])
            build.completed_at          = datetime.utcnow()
            db.commit()

    project = db.get(Project, state.get("project_id"))
    if project:
        if deploy_url:
            project.latest_deploy_url = deploy_url
        if repo_url:
            project.repo_url = repo_url
        db.commit()


def _publish_connect_railway(project_id: str, build_id: str):
    """
    Emit connect_railway artifact via Redis (flat shape matching frontend).
    Called when deployer needs Railway key but user hasn't set it yet.
    Does NOT resume the graph — graph stays paused at deployer interrupt.
    """
    import json
    from app.core.redis import publish

    content = json.dumps({
        "build_id": build_id,
        "status":   "waiting_for_railway_key",
        "message":  (
            "🚂 Almost there! Your app is built and security-tested.\n\n"
            "To deploy, connect your Railway account once.\n"
            "Future deployments are fully automatic — you'll never be asked again.\n\n"
            "Get your token: railway.app → Account Settings → Tokens"
        ),
    })

    publish(project_id, {
        "type":          "artifact",
        "artifact_type": "connect_railway",
        "title":         "Connect Railway to Deploy",
        "content":       content,
    })
    publish(project_id, {"type": "done"})
    log.info("Emitted connect_railway for project=%s build=%s", project_id, build_id)

# ═══════════════════════════════════════════════════════════════════
# TASK 1 — START WORKFLOW
# Called when user sends the very first message to a project.
# ═══════════════════════════════════════════════════════════════════

@celery_app.task(bind=True, name="workers.start_workflow", max_retries=1)
def start_workflow_task(
    self,
    project_id:          str,
    thread_id:           str,
    user_message:        str,
    message_type:        str,  # MessageType value (str enum is JSON-safe)
    project_name:        str,
    project_description: str,
):
    from app.core.redis import publish

    db = _db()
    try:
        wf     = _workflow()
        config = {"configurable": {"thread_id": thread_id}}

        initial_state = {
            "project_id":           project_id,
            "build_id":             None,
            "project_name":         project_name,
            "project_description":  project_description,
            "chat_history":         [],
            "current_user_input":   {
                "message":      user_message,
                "message_type": message_type,
            },
            "current_plan":         None,
            "approved_plan":        None,
            "app_url":              None,
            "security_iteration":   0,
            "security_issues":      [],
            "all_security_issues":  [],
            "deploy_payload":       None,
            "artifacts":            [],
            "messages_to_save":     [],
            "repo_url":             None,
            "deploy_url":           None,
            "error":                None,
        }

        # Run — interrupt_before=["conductor"] will pause immediately.
        # First stream initializes state and checkpoints it.
        for _ in wf.stream(initial_state, config=config):
            pass

        # Now resume — conductor_node will read current_user_input from state
        # (set in initial_state above) and process the first message.
        # After conductor finishes, it loops back to itself with current_user_input=None,
        # which triggers interrupt_before again — pausing for the next user message.
        # Note: Use None (not Command(resume=None)) to avoid LangGraph 1.0.9 bug
        for _ in wf.stream(None, config=config):
            pass

        snap  = wf.get_state(config)
        state = dict(snap.values)
        _save_state_to_db(db, state, project_id, state.get("build_id"))

        # Don't publish "done" here — conductor_node already publishes
        # {"type": "done", "waiting_for": "user_input"} before it loops back.

    except Exception as e:
        log.exception("start_workflow_task failed project=%s", project_id)
        publish(project_id, {"type": "build_failed", "reason": str(e)})
        raise self.retry(exc=e, countdown=30)
    finally:
        db.close()

# ═══════════════════════════════════════════════════════════════════
# TASK 2 — RESUME WORKFLOW
# Called for every user message after the first.
# Covers: chat, plan edits, APPROVE, and messages during build.
# ═══════════════════════════════════════════════════════════════════

@celery_app.task(bind=True, name="workers.resume_workflow", max_retries=1)
def resume_workflow_task(
    self,
    project_id:   str,
    thread_id:    str,
    user_message: str,
    message_type: str,  # MessageType value (str enum is JSON-safe)
    edited_plan:  dict = None,
):
    from app.core.redis import publish

    db = _db()
    try:
        wf     = _workflow()
        config = {"configurable": {"thread_id": thread_id}}

        snap = wf.get_state(config)
        if not snap or not snap.values:
            raise ValueError(f"No LangGraph state for thread {thread_id}")

        state      = dict(snap.values)
        next_nodes = list(snap.next or [])

        # Guard: build already running — only conductor accepts user input
        waiting_at_conductor = (not next_nodes or "conductor" in next_nodes)
        if not waiting_at_conductor:
            publish(project_id, {
                "type":  "text_chunk",
                "chunk": "🔨 Build is running — please wait until it completes.\n",
                "role":  "conductor",
            })
            publish(project_id, {"type": "done"})
            return

        # Create build row on approval (before resuming graph)
        if message_type == MessageType.APPROVAL:
            current_plan = state.get("current_plan")
            if not current_plan:
                publish(project_id, {
                    "type":  "text_chunk",
                    "chunk": "⚠️ No plan to approve yet.\n",
                    "role":  "conductor",
                })
                publish(project_id, {"type": "done"})
                return

            if not state.get("build_id"):
                build_id = _create_build(db, project_id, current_plan)
                wf.update_state(config, {"build_id": build_id})
                log.info("Build created project=%s build=%s", project_id, build_id)

        # ── Build the resume payload — this becomes current_user_input in GraphState
        resume_payload = {
            "message":      user_message,
            "message_type": message_type,
        }
        if message_type == MessageType.EDIT_PLAN and edited_plan:
            resume_payload["edited_plan"] = edited_plan

        for _ in wf.stream(
            Command(resume=resume_payload),
            config=config,
        ):
            pass

        snap  = wf.get_state(config)
        state = dict(snap.values)
        _save_state_to_db(db, state, project_id, state.get("build_id"))

        if not snap.next:
            # Graph completed (reached END) — finalize build in DB
            _finalise_build(db, state)
            # Deployer node already published its own "done" event with deploy_url/repo_url.
            # No need to publish again — avoid double "done" which confuses SSE.
        # else: graph paused at an interrupt — the node that interrupted already published "done"

    except Exception as e:
        log.exception("resume_workflow_task failed project=%s", project_id)
        publish(project_id, {"type": "build_failed", "reason": str(e)})
        raise self.retry(exc=e, countdown=30)
    finally:
        db.close()
        

# ═══════════════════════════════════════════════════════════════════
# TASK 3 — RAILWAY CONNECT
# Called by POST /account/railway-key AFTER the key is stored.
# Checks if a build is currently paused waiting for Railway key.
# If yes → resumes the graph with a railway_connected signal.
# The deployer node sees this and skips the Railway prompt → emits env_var_request.
# ═══════════════════════════════════════════════════════════════════
@celery_app.task(bind=True, name="workers.railway_connect", max_retries=1)
def railway_connect_task(self, project_id: str, thread_id: str):
    """
    Called after user successfully saves their Railway API key.
    Checks if the deployer is currently waiting for Railway key.
    If so, resumes with {"railway_connected": True, "stage": "env_vars"}.
    Deployer sees this → skips Railway check → goes straight to env_var_request.
    """
    from app.core.redis import publish

    db = _db()
    try:
        wf     = _workflow()
        config = {"configurable": {"thread_id": thread_id}}

        snap = wf.get_state(config)
        if not snap or not snap.values:
            # No active build — key saved for future use, nothing to resume
            publish(project_id, {"type": "done", "status": "no_active_build"})
            return

        next_nodes = list(snap.next or [])

        # Only resume if deployer is waiting for Railway key specifically
        # (graph will be paused at "deployer" node, not conductor)
        if "deployer" not in next_nodes and next_nodes:
            # Build is at a different stage — key saved for future, nothing to do now
            publish(project_id, {"type": "done", "status": "key_saved"})
            return

        log.info("Resuming deployer after Railway connect project=%s", project_id)

        # Resume deployer — signal that Railway is now connected
        # Deployer node will skip Railway check and emit env_var_request
        for _ in wf.stream(
            Command(resume={"railway_connected": True, "stage": "env_vars"}),
            config=config,
        ):
            pass

        snap  = wf.get_state(config)
        state = dict(snap.values)
        _save_state_to_db(db, state, project_id, state.get("build_id"))

        if not snap.next:
            _finalise_build(db, state)
            # Deployer node already published "done" with deploy_url/repo_url
        # else: deployer interrupted again (e.g. for env_vars) — it published "done" itself

    except Exception as e:
        log.exception("railway_connect_task failed project=%s", project_id)
        publish(project_id, {"type": "build_failed", "reason": str(e)})
        raise self.retry(exc=e, countdown=30)
    finally:
        db.close()
        
# ═══════════════════════════════════════════════════════════════════
# TASK 4 — DEPLOY CONFIRM
# User submitted plaintext app env vars.
# Worker assembles FULL deploy_payload from DB — no secrets from user.
# Checks Railway key in DB BEFORE resuming graph.
# If missing → emit connect_railway card directly via Redis (no graph resume).
# ═══════════════════════════════════════════════════════════════════

@celery_app.task(bind=True, name="workers.deploy_confirm", max_retries=1)
def deploy_confirm_task(
    self,
    project_id:     str,
    thread_id:      str,
    user_id:        str,          # needed to fetch credentials from DB
    plaintext_vars: dict,         # user's app env vars (STRIPE_KEY, DATABASE_URL etc.)
):
    """
    WHAT THIS TASK DOES:
    1. Fetches github_token from user.github_token_encrypted (server-side decrypt)
    2. Fetches railway_api_key from user.railway_api_key_encrypted (server-side decrypt)
    3. If railway_api_key missing → emit connect_railway card via Redis, return (don't resume graph)
    4. If all present → assemble deploy_payload → resume deployer node

    USER SENDS:    only plaintext_vars (their app secrets)
    SERVER BUILDS: complete deploy_payload including platform credentials
    """
    from app.core.redis import publish
    from app.utils.encryption import decrypt_token

    db = _db()
    try:
        wf     = _workflow()
        config = {"configurable": {"thread_id": thread_id}}

        # ── Fetch user credentials from DB ─────────────────────────
        user = _get_user(db, user_id)
        if not user:
            raise ValueError(f"User {user_id} not found")

        # GitHub token — set at OAuth login, should always exist
        if not user.github_token_encrypted:
            publish(project_id, {
                "type":  "text_chunk",
                "chunk": "❌ GitHub account not connected. Please reconnect via GitHub login.\n",
                "role":  "system",
            })
            publish(project_id, {"type": "done"})
            return

        # Railway key — check BEFORE resuming graph
        if not user.railway_api_key_encrypted:
            # Get build_id from graph state for the artifact
            snap     = wf.get_state(config)
            build_id = (snap.values or {}).get("build_id", "")
            # Emit connect_railway card directly — graph stays paused
            _publish_connect_railway(project_id, build_id)
            return

        # ── Decrypt credentials (RAM only from here) ───────────────
        github_token    = decrypt_token(user.github_token_encrypted)
        railway_api_key = decrypt_token(user.railway_api_key_encrypted)

        log.info("deploy_confirm project=%s user=%s vars_count=%d", project_id, user_id, len(plaintext_vars))
        # NEVER: log.info("vars=%s", plaintext_vars)

        # ── Assemble full deploy_payload ───────────────────────────
        deploy_payload = {
            "plaintext_vars":  plaintext_vars,
            "github_token":    github_token,
            "railway_api_key": railway_api_key,
        }

        # ── Resume deployer node ───────────────────────────────────
        for _ in wf.stream(Command(resume=deploy_payload), config=config):
            pass

        snap  = wf.get_state(config)
        state = dict(snap.values)

        # Wipe credentials from graph state
        wf.update_state(config, {"deploy_payload": None})
        state["deploy_payload"] = None

        _save_state_to_db(db, state, project_id, state.get("build_id"))

        if not snap.next:
            _finalise_build(db, state)
            # Deployer node already published "done" with deploy_url/repo_url
        # else: deployer interrupted again — it published "done" itself

    except Exception as e:
        log.exception("deploy_confirm_task failed project=%s", project_id)
        publish(project_id, {"type": "build_failed", "reason": str(e)})
        raise self.retry(exc=e, countdown=30)
    finally:
        # Always wipe
        plaintext_vars.clear()
        if "github_token"    in dir(): github_token    = None  # noqa
        if "railway_api_key" in dir(): railway_api_key = None  # noqa
        if "deploy_payload"  in dir(): deploy_payload  = None  # noqa
        db.close()
