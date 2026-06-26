# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

NexusAI ("Shipyard") is an AI app builder: a user describes an app, and a multi-agent
pipeline plans it, writes and tests it (in Docker), security-tests it, and deploys it
(GitHub + Railway). Monorepo:

- `client/` — Next.js 16 frontend (React 19, Tailwind v4, shadcn/ui, NextAuth v5)
- `server/` — FastAPI backend (Python 3.11, SQLAlchemy 2.0 async, LangGraph, Celery)

## Commands

### Server (`server/`, run inside the venv: `.\venv\Scripts\Activate.ps1`)

| Action | Command |
| --- | --- |
| Run API | `python -m app.main` or `make dev` (uvicorn, port 8000) |
| Run Celery worker (required for builds) | `make worker` (Windows uses `--pool=solo`) |
| Start Redis | `docker-compose up -d redis` |
| Start everything (Windows) | `make start-all` / `./start_all.ps1` |
| Lint / format | `make lint` (ruff) / `make format` |
| DB migrate | `alembic upgrade head` |
| New migration | `alembic revision --autogenerate -m "msg"` |
| Inspect Celery | `make celery-tasks`, `make celery-purge` |

After `pip install <pkg>`, refresh deps with `pip freeze > requirements.txt`.
The Celery app lives at `app.tasks.build_task:celery_app` (name `"aibuild"`).

### Client (`client/`)

| Action | Command |
| --- | --- |
| Dev server | `npm run dev` (port 3000) |
| Build | `npm run build` |
| Lint | `npm run lint` |

No test runner is configured in either package.

## Architecture

### The build pipeline (server, the heart of the system)

A **4-agent LangGraph** state machine in `app/agents/workflow.py`:

```
Conductor → Artificer → Guardian → Deployer
```

- **Conductor** — streams conversation and a **plan artifact** to the user, then
  parks on a human-in-loop interrupt for approval. The plan artifact (`artifact_type:
  "plan"`) carries overview, tech_stack, architecture diagram, DB schemas, and
  endpoints. On approval only its `content` dict is kept as `approved_plan`.
- **Artificer** — a ReAct agent with Docker tools (`app/agents/tools/docker_tools.py`)
  that writes and fixes code inside a Docker container.
- **Guardian** — a ReAct agent with security tools
  (`app/agents/tools/security_tools.py`) that attacks the running app.
- **Deployer** — a ReAct agent with deploy tools (`app/agents/tools/deploy_tools.py`)
  that pushes to GitHub and deploys to Railway.

> The workflow interrupts for human approval of the plan, so the graph parks between
> user messages. `app/agents/workflow_approval_tests.py` exercises this approval path.

### Credential & deploy flow (the tricky part)

**Credential assembly happens in the Celery worker, not in graph nodes** — workers have
natural DB access; graph nodes should not. See `app/tasks/build_task.py`. Tasks:

- `start_workflow_task` — first message, starts the LangGraph thread.
- `resume_workflow_task` — every subsequent chat/approval message.
- `deploy_confirm_task` — user submitted plaintext env vars; worker assembles the full
  `deploy_payload` (plaintext vars + GitHub token + Railway key, both decrypted from the
  `User` row) and resumes the graph so the Deployer runs the Railway deploy.
- `railway_connect_task` — fires after the user saves their Railway key; resumes a build
  that was parked waiting for it.

If `railway_api_key_encrypted` is NULL at deploy time, `deploy_confirm_task` publishes a
`connect_railway` event over Redis (no graph resume) → the frontend shows an inline
"connect Railway" card → user pastes the key → `POST /account/railway-key`
(`app/api/routes/v1/env_vars.py`) → `railway_connect_task`.

### Execution & streaming (Celery + Redis + SSE)

The graph runs in a Celery worker, never the request thread:

1. An API route enqueues a Celery task (`build_task.py`, broker = Redis).
2. The worker drives the graph until an interrupt or END, calling
   `publish(project_id, event)` for every thinking/step/tool/text-chunk event.
3. `publish` writes to Redis channel `project:{project_id}:stream` (sync client,
   `app/core/redis.py`).
4. The FastAPI SSE endpoint (`message_routes.py`) consumes `subscribe_and_stream()` via
   **sse-starlette `EventSourceResponse`** and streams frames to the browser.

> `app/core/redis.py` documents the uvicorn buffering bug at length — SSE **must** use
> `EventSourceResponse`, not plain `StreamingResponse`, or events buffer and arrive all
> at once. The client consumes the stream in `client/hooks/use-workflow.ts`.

Terminal/close events: `done`, `build_failed`, `close_stream`.

### Docker sandbox (`app/core/docker_manager.py`)

One container per build. Container always exposes port **8080 internally**; the host
port is random (Docker-chosen) — agents reach the app at `http://localhost:{app_port}`.
`spin_up()` is idempotent (reattaches on worker retry), `write_file()` blocks `..` path
traversal, and `RunConfig` is serialized into the `Build` row so the Deployer can
reattach across Celery nodes.

### Backend layout

- `app/main.py` mounts five routers under `/api/v1`: `user`, `project`, `message`,
  `build`, `artifact`. `env_vars.py` defines the `/account` router (Railway key,
  credential status) used by the deploy flow.
- `app/api/middleware/auth.py` — `NextAuthJWTMiddleware` validates the NextAuth JWT
  (shared `NEXTAUTH_SECRET` between client and server).
- `app/models/` — SQLAlchemy models; `app/repositories/` — data access;
  `app/schemas/` — Pydantic + enums (`WorkflowStage`).
- `app/core/` — `config.py` (pydantic-settings), `database.py` (async engine),
  `llm.py` (LLM factory — Anthropic / langchain), `docker_manager.py`, `redis.py`,
  `stream_parser.py`.
- `app/utils/encryption.py` — token encryption (`ENCRYPTION_KEY`); used for the
  GitHub/Railway credentials the Deployer reads.
- `app/agents/embedder.py` + `rag.py` — embeddings/RAG (pgvector, sentence-transformers).

### Frontend layout

- App Router under `client/app/`: `(auth)/login`, `getting-started`, `home/*`
  (projects, settings), `project/[id]`, `workspace`. NextAuth route at
  `app/api/auth/[...nextauth]`.
- `client/proxy.ts` is the Next.js **middleware**: enforces auth and an onboarding gate
  (`onboardingCompleted` → redirects to `/getting-started`).
- State: Zustand stores in `store/` (`artifact-store`, `code-store`,
  `right-sidebar-store`, `workflow-store`); server data via `@tanstack/react-query`.
- API client in `lib/api/` (axios), wrapping the FastAPI backend
  (`NEXT_PUBLIC_API_URL`). Workspace uses a Monaco editor under
  `components/workspace/code-editor/` + `react-complex-tree`.

## Environment

Both `client/.env.local` and `server/.env` must share the same `NEXTAUTH_SECRET`.

- `server/.env`: `DATABASE_URL` (postgresql+asyncpg://…), `NEXTAUTH_SECRET`,
  `ENCRYPTION_KEY`, `REDIS_URL`, `ANTHROPIC_API_KEY`.
- `client/.env.local`: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_GITHUB_ID`,
  `AUTH_GITHUB_SECRET`, `NEXT_PUBLIC_API_URL`.

## Notes

- Windows-first dev: PowerShell scripts (`start_all.ps1`, `start_celery.ps1`) and the
  Celery `--pool=solo` flag exist because the worker runs on Windows.
- A build requires three processes up: Redis, FastAPI, and a Celery worker. Without the
  worker, builds enqueue but never run.
