"""
tasks/build_worker.py

Celery tasks that drive the LangGraph workflow.

FLOW:
  start_workflow_task  → seeds state → conductor → (if build) artificer → deployer → END
  resume_workflow_task → injects user message → conductor → (if build) artificer → deployer → END

  Deployer runs automatically after artificer — no interrupt, no credential injection,
  no env var form. Credentials are fetched directly from the User DB record inside
  deployer_node (decrypted in-node).

KEY POINTS:
  1. Only interrupt_before=["conductor"] — graph parks between user messages only.
  2. user_id is seeded into GraphState so deployer_node can fetch credentials.
  3. _stream_until_interrupt_or_end drives the graph until conductor interrupt or END.
  4. No deploy_payload, no pending_plaintext_vars, no env var form logic.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from celery import Celery
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import settings

log = logging.getLogger(__name__)

# ── Celery app ────────────────────────────────────────────────────

celery_app = Celery("aibuild", broker=settings.REDIS_URL, backend=settings.REDIS_URL)
celery_app.conf.update(
    task_serializer            = "json",
    result_serializer          = "json",
    accept_content             = ["json"],
    timezone                   = "UTC",
    task_track_started         = True,
    task_acks_late             = True,
    task_reject_on_worker_lost = True,
    worker_prefetch_multiplier = 1,
    result_expires             = 60,
)

# ── Module-level DB pool ──────────────────────────────────────────

def _fix_ssl(url: str) -> str:
    return (
        url
        .replace("?ssl=require", "?sslmode=require")
        .replace("&ssl=require", "&sslmode=require")
    )


_engine: object | None = None
_SessionFactory: sessionmaker | None = None


def _get_session() -> Session:
    global _engine, _SessionFactory
    if _SessionFactory is None:
        _engine = create_engine(
            _fix_ssl(settings.DATABASE_URL),
            pool_size     = 5,
            max_overflow  = 10,
            pool_pre_ping = True,
        )
        _SessionFactory = sessionmaker(bind=_engine, expire_on_commit=False)
    return _SessionFactory()


# ── LangGraph workflow factory ────────────────────────────────────

_workflow_graph = None


def _workflow():
    global _workflow_graph
    if _workflow_graph is None:
        from app.agents.workflow import create_workflow
        _workflow_graph = create_workflow(_fix_ssl(settings.DATABASE_URL))
        log.info("LangGraph workflow created and cached for worker process")
    return _workflow_graph


# ── Constants ─────────────────────────────────────────────────────

MAX_GRAPH_STEPS = 20


# ═══════════════════════════════════════════════════════════════════
# DB HELPERS
# ═══════════════════════════════════════════════════════════════════

def _create_build(db: Session, project_id: str, description: str = "") -> str:
    """Create a Build row and return its string ID."""
    from app.models import Build

    result = db.execute(
        select(func.coalesce(func.max(Build.build_number), 0))
        .where(Build.project_id == project_id)
        .with_for_update()
    )
    next_num = result.scalar_one() + 1

    build = Build(
        project_id    = project_id,
        build_number  = next_num,
        status        = "building",
        approved_plan = {"description": description},
        started_at    = datetime.now(timezone.utc),
    )
    db.add(build)
    db.flush()
    db.commit()
    return str(build.id)


def _save_state_to_db(db: Session, state: dict, project_id: str, build_id: str | None) -> dict:
    """Persist messages + artifacts. Clears them from state to prevent double-save."""
    from app.models import Message, Artifact, Build

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
            project_id   = project_id,
            role         = msg["role"],
            message_type = msg["message_type"],
            content      = real_blocks,
            metadata_    = msg.get("metadata"),
        ))

    run_config = state.get("run_config")
    if run_config and build_id:
        build = db.get(Build, build_id)
        if build:
            meta = build.metadata_ or {}
            meta["run_config"] = run_config if isinstance(run_config, dict) else run_config.to_dict()
            build.metadata_    = meta

    db.commit()

    state["artifacts"]        = []
    state["messages_to_save"] = []
    return state


def _finalise_build(db: Session, state: dict) -> None:
    """Mark Build completed/failed and update Project with deploy/repo URLs."""
    from app.models import Build, Project

    build_id   = state.get("build_id")
    deploy_url = state.get("deploy_url")
    repo_url   = state.get("repo_url")

    if build_id:
        build = db.get(Build, build_id)
        if build:
            build.status       = "failed" if state.get("error") else "completed"
            build.deploy_url   = deploy_url
            build.repo_url     = repo_url
            build.completed_at = datetime.now(timezone.utc)

    project = db.get(Project, state.get("project_id"))
    if project:
        if deploy_url:
            project.latest_deploy_url = deploy_url
        if repo_url:
            project.repo_url = repo_url

    db.commit()


def _stream_until_interrupt_or_end(wf, config: dict, db: Session, project_id: str) -> dict:
    """
    Drive the graph forward step by step until:
      - Reaches END (snap.next is empty)
      - Hits the conductor interrupt (snap.next == ["conductor"])

    With the simplified flow (no deployer interrupt), the graph runs
    conductor → artificer → deployer → END in one continuous pass
    after a build is requested. This loop just keeps it moving.

    Returns the final state dict.
    """
    from app.models import Build

    for step in range(MAX_GRAPH_STEPS):
        for _ in wf.stream(None, config=config):
            pass

        snap  = wf.get_state(config)
        state = dict(snap.values)

        # Create Build row as soon as conductor sets build_requested
        if state.get("build_requested") and not state.get("build_id"):
            build_id = _create_build(db, project_id, state.get("build_description", ""))
            wf.update_state(config, {"build_id": build_id})
            state["build_id"] = build_id
            log.info("Build created project=%s build=%s", project_id, build_id)

        next_nodes = list(snap.next or [])

        # Parked at conductor interrupt or fully done
        if not next_nodes or next_nodes == ["conductor"]:
            return state

        log.debug("Graph step=%d next=%s project=%s", step, next_nodes, project_id)

    raise RuntimeError(
        f"Graph exceeded MAX_GRAPH_STEPS ({MAX_GRAPH_STEPS}) for project={project_id}. "
        "Possible infinite loop — aborting."
    )


def _reset_graph_to_conductor(wf, config: dict, fresh_state: dict) -> None:
    """
    Re-seed the graph with fresh_state so it parks at the conductor interrupt.
    Used to unstick the graph after a crash or mid-pipeline failure.
    """
    log.info("Resetting graph to conductor for thread=%s", config["configurable"]["thread_id"])
    for _ in wf.stream(fresh_state, config=config):
        pass
    snap = wf.get_state(config)
    log.info("Graph reset — next=%s", list(snap.next or []))


def _blank_state(project_id: str, project_name: str, project_description: str,
                 user_id: str, chat_history: list | None = None, error: str | None = None) -> dict:
    """Return a clean GraphState dict for seeding or resetting."""
    return {
        "project_id":          project_id,
        "user_id":             user_id,
        "build_id":            None,
        "project_name":        project_name,
        "project_description": project_description,
        "chat_history":        chat_history or [],
        "current_user_input":  None,
        "build_requested":     False,
        "build_description":   "",
        "tech_stack_hint":     None,
        "run_config":          None,
        "app_url":             None,
        "artifacts":           [],
        "messages_to_save":    [],
        "repo_url":            None,
        "deploy_url":          None,
        "error":               error,
    }


# ═══════════════════════════════════════════════════════════════════
# TASK 1 — START WORKFLOW
# First user message for a project. Seeds state and runs the pipeline.
# ═══════════════════════════════════════════════════════════════════

@celery_app.task(bind=True, name="workers.start_workflow", max_retries=1)
def start_workflow_task(
    self,
    project_id:          str,
    thread_id:           str,
    user_id:             str,
    user_message:        str,
    message_type:        str,
    project_name:        str,
    project_description: str,
) -> None:
    from app.core.redis import publish

    db = _get_session()
    try:
        wf     = _workflow()
        config = {"configurable": {"thread_id": thread_id}}

        initial_state = _blank_state(project_id, project_name, project_description, user_id)
        initial_state["current_user_input"] = {"message": user_message, "message_type": message_type}

        # Seed state — parks at interrupt_before=["conductor"]
        for _ in wf.stream(initial_state, config=config):
            pass

        # Run conductor (and entire pipeline if build was requested)
        state = _stream_until_interrupt_or_end(wf, config, db, project_id)

        _save_state_to_db(db, state, project_id, state.get("build_id"))

        snap = wf.get_state(config)
        if not snap.next:
            _finalise_build(db, state)

        publish(project_id, {"type": "close_stream"})

    except Exception as e:
        log.exception("start_workflow_task failed project=%s", project_id)
        publish(project_id, {"type": "build_failed", "reason": str(e)})
        publish(project_id, {"type": "close_stream"})

        try:
            _reset_graph_to_conductor(wf, config,
                _blank_state(project_id, project_name, project_description, user_id, error=str(e)))
        except Exception:
            log.exception("Failed to reset graph after error project=%s", project_id)
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════
# TASK 2 — RESUME WORKFLOW
# Every user message after the first.
# ═══════════════════════════════════════════════════════════════════

@celery_app.task(bind=True, name="workers.resume_workflow", max_retries=1)
def resume_workflow_task(
    self,
    project_id:   str,
    thread_id:    str,
    user_id:      str,
    user_message: str,
    message_type: str,
) -> None:
    from app.core.redis import publish

    db = _get_session()
    try:
        wf     = _workflow()
        config = {"configurable": {"thread_id": thread_id}}

        snap = wf.get_state(config)
        if not snap or not snap.values:
            raise ValueError(f"No LangGraph state for thread {thread_id}")

        next_nodes = list(snap.next or [])
        state      = dict(snap.values)

        # ── Stale build recovery ──────────────────────────────────
        # Graph stuck mid-pipeline (artificer/deployer crashed) — reset it.
        if next_nodes and next_nodes != ["conductor"]:
            log.warning(
                "Graph stuck at %s for project=%s — resetting (stale build recovery)",
                next_nodes, project_id,
            )
            publish(project_id, {
                "type":  "text_chunk",
                "chunk": "⚠️ Previous build was interrupted. Resetting so you can continue.\n",
                "role":  "conductor",
            })

            _reset_graph_to_conductor(wf, config, _blank_state(
                project_id,
                state.get("project_name", ""),
                state.get("project_description", ""),
                user_id,
                chat_history = state.get("chat_history", []),
            ))

        # ── Inject new user message and resume ────────────────────
        wf.update_state(config, {
            "current_user_input": {"message": user_message, "message_type": message_type},
            "user_id": user_id,   # refresh in case it was wiped during reset
        })

        state = _stream_until_interrupt_or_end(wf, config, db, project_id)

        _save_state_to_db(db, state, project_id, state.get("build_id"))

        snap = wf.get_state(config)
        if not snap.next:
            _finalise_build(db, state)

        publish(project_id, {"type": "close_stream"})

    except Exception as e:
        log.exception("resume_workflow_task failed project=%s", project_id)
        publish(project_id, {"type": "build_failed", "reason": str(e)})
        publish(project_id, {"type": "close_stream"})

        try:
            _reset_graph_to_conductor(wf, config,
                _blank_state(project_id, "", "", user_id, error=str(e)))
        except Exception:
            log.exception("Failed to reset graph after error project=%s", project_id)
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════
# DEPRECATED TASKS
# Kept for reference. No longer used — deployer fetches its own
# credentials directly from the User DB record.
# ═══════════════════════════════════════════════════════════════════

# @deprecated — Railway key prompt flow removed. Deployer fetches credentials internally.
# def railway_connect_task(...): ...

# @deprecated — Env var form removed. No deployer interrupt, no credential injection.
# def deploy_confirm_task(...): ...

# @deprecated — connect_railway SSE artifact no longer emitted.
# def _publish_connect_railway(...): ...