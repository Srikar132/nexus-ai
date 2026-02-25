"""
agents/workflow.py

4-Agent LangGraph workflow — complete, production-ready.

AGENTS:
  Conductor  — streams conversation + plan artifacts, human-in-loop interrupt
  Artificer  — ReAct agent with Docker tools, writes + fixes code
  Guardian   — ReAct agent with security tools, attacks the running app
  Deployer   — ReAct agent with deploy tools, pushes GitHub + deploys cloud

DATA FLOW:
  The Conductor generates a plan artifact with this structure:
  {
    "artifact_type": "plan",
    "title": "...",
    "content": {
      "status": "pending_approval",
      "overview": "High-level overview of the app and its features",
      "tech_stack": {
        "language": "python",
        "framework": "fastapi",
        "database": "postgresql"
      },
      "architecture": {
        "diagram": "flowchart TD; A[User] --> B[Conductor]; B --> C[Artificer]; C --> D[Guardian]; D --> E[Deployer];",
        "content": "Description of the system architecture and component relationships"
      },
      "database_schemas": {
        "users": {
          "id": "UUID",
          "email": "VARCHAR",
          "username": "VARCHAR",
          "onboardingCompleted": "BOOLEAN"
        },
        "projects": {
          "id": "UUID", 
          "name": "VARCHAR",
          "description": "TEXT",
          "ownerId": "UUID"
        }
      },
      "endpoints": [
        {
          "path": "/api/users",
          "method": "GET", 
          "description": "Fetch all users"
        },
        {
          "path": "/api/projects",
          "method": "GET",
          "description": "Fetch all projects"
        }
      ]
    }
  }
  
  When approved, only the "content" dict is stored in approved_plan:
  approved_plan = {
    "status": "pending_approval",
    "overview": "High-level overview of the app and its features",
    "tech_stack": {
      "language": "python",
      "framework": "fastapi", 
      "database": "postgresql"
    },
    "architecture": {
      "diagram": "flowchart TD; A[User] --> B[Conductor]; B --> C[Artificer]; C --> D[Guardian]; D --> E[Deployer];",
      "content": "Description of the system architecture and component relationships"
    },
    "database_schemas": {
      "users": {
        "id": "UUID",
        "email": "VARCHAR", 
        "username": "VARCHAR",
        "onboardingCompleted": "BOOLEAN"
      },
      "projects": {
        "id": "UUID",
        "name": "VARCHAR",
        "description": "TEXT", 
        "ownerId": "UUID"
      }
    },
    "endpoints": [
      {
        "path": "/api/users",
        "method": "GET",
        "description": "Fetch all users"
      },
      {
        "path": "/api/projects", 
        "method": "GET",
        "description": "Fetch all projects"
      }
    ]
  }

GRAPH FLOW:
  conductor  ←── interrupt (waits for every user message) ──────────┐
      │ APPROVE detected                                             │
      ↓                                                              │
  artificer  (write mode — generates all files via ReAct)           │
      │                                                              │
      ↓                                                              │
  guardian   (security attack loop via ReAct) ←──────────┐          │
      │ issues found                                       │          │
      │  → artificer (fix mode) ───────────────────────────┘          │
      │ no issues / max iterations reached                           │
      ↓                                                              │
  deployer   (interrupt for env vars → ReAct GitHub + cloud deploy) │
      ↓                                                              │
    [END]                                                            │
"""


"""
agents/workflow.py

DEPLOYER NODE — clean, no DB access.

The node receives its state via two possible interrupts:

  INTERRUPT 1 — waiting_for_railway_key
    Emitted when worker detects Railway key missing (before resuming graph).
    Actually this interrupt is never reached if worker handles it:
    Worker calls _publish_connect_railway() → user connects → railway_connect_task
    → resumes graph with {"railway_connected": True, "stage": "env_vars"}
    → deployer skips Railway prompt, emits env_var_request

  INTERRUPT 2 — waiting_for_env_vars
    Deployer emits env_var_request artifact, interrupts.
    deploy_confirm_task resumes with full deploy_payload assembled by worker.
    deploy_payload = {plaintext_vars, github_token, railway_api_key}

The deployer node NEVER touches the DB.
All credential fetching happens in the worker (build_worker.py).
"""

import json
import uuid
import time
from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.types import interrupt, Command

import anthropic
from app.core.config import settings
from app.core.redis import publish
from app.core.stream_parser import StreamParser, ARTIFACT_START, ARTIFACT_END
from app.core.docker_manager import DockerManager
from app.agents.rag import ProjectRAG
from app.agents.react import run_react_agent
from app.agents.tools.docker_tools import get_docker_tools
from app.agents.tools.security_tools import get_security_tools
from app.agents.tools.deploy_tools import get_deploy_tools
from app.agents.rag import ProjectRAG

ai = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

# ═══════════════════════════════════════════════════════════════════
# GRAPH STATE — persisted to PostgreSQL between interrupts
# ═══════════════════════════════════════════════════════════════════

class GraphState(TypedDict):
    # Identity
    project_id:          str
    build_id:            Optional[str]
    project_name:        str
    project_description: str

    # Conversation (conductor context window)
    chat_history:         list[dict]   # [{role, content}] last 40 exchanges
    current_user_message: str

    # Plan — current_plan and approved_plan both store only the "content" dict from plan artifacts
    # (NOT the full artifact wrapper with "artifact_type" and "title")
    current_plan:  Optional[dict]  # Pending plan content, not yet approved
    approved_plan: Optional[dict]  # Approved plan content, used by artificer/guardian/deployer

    # Build runtime
    app_url: Optional[str]   # URL where app runs for Guardian to attack

    # Security loop
    security_iteration:  int
    security_issues:     list[dict]   # current round issues (cleared after each fix)
    all_security_issues: list[dict]   # cumulative across all rounds

    # Deployment credentials — plaintext, RAM only, NEVER persisted to DB
    # Set by deploy_confirm_task, cleared by deployer node after use
    deploy_payload: Optional[dict]

    # Collected per-run, saved to DB by worker, then cleared
    artifacts:        list[dict]
    messages_to_save: list[dict]

    # Final outputs
    repo_url:   Optional[str]
    deploy_url: Optional[str]
    error:      Optional[str]


# ═══════════════════════════════════════════════════════════════════
# CONDUCTOR STREAMING HELPER
# Conductor uses the raw Anthropic SDK for true token streaming.
# (ReAct agents use LangChain — conductor is purely conversational.)
# ═══════════════════════════════════════════════════════════════════

def _stream_conductor(
    project_id: str,
    system:     str,
    messages:   list,
) -> tuple[list[dict], list[dict]]:
    """
    Stream tokens from Claude.  Returns (blocks, artifacts).
    blocks   — [{type: "text", content: "..."}, {type: "artifact", artifact_id: "temp-uuid"}]
    artifacts — [{temp_id, artifact_type, title, content}]
    """
    parser       = StreamParser()
    blocks:      list[dict] = []
    artifacts:   list[dict] = []
    current_text = ""

    with ai.messages.stream(
        model      = "claude-opus-4-6",
        max_tokens = 2000,
        system     = system,
        messages   = messages,
    ) as stream:
        for token in stream.text_stream:
            for event in parser.feed(token):
                if event.kind == "text":
                    current_text += event.text
                    publish(project_id, {
                        "type":  "text_chunk",
                        "chunk": event.text,
                        "role":  "conductor",
                    })
                elif event.kind == "artifact":
                    if current_text:
                        blocks.append({"type": "text", "content": current_text})
                        current_text = ""
                    temp_id = str(uuid.uuid4())
                    artifacts.append({"temp_id": temp_id, **event.artifact})
                    blocks.append({"type": "artifact", "artifact_id": temp_id})
                    publish(project_id, {
                        "type":          "artifact",
                        "artifact_id":   temp_id,
                        "artifact_data": event.artifact,
                        "role":          "conductor",
                    })

    for event in parser.flush():
        if event.kind == "text":
            current_text += event.text
            publish(project_id, {
                "type":  "text_chunk",
                "chunk": event.text,
                "role":  "conductor",
            })

    if current_text:
        blocks.append({"type": "text", "content": current_text})

    return blocks, artifacts


# ═══════════════════════════════════════════════════════════════════
# NODE 1 — CONDUCTOR
# ═══════════════════════════════════════════════════════════════════

APPROVAL_KEYWORDS = [
    "approve", "approved", "looks good", "lgtm",
    "start build", "go ahead", "proceed", "ship it", "build it",
]


def conductor_node(state: GraphState) -> Command:
    project_id   = state["project_id"]
    user_input   = state.get("current_user_input") or {}
    user_message = user_input.get("message", "")
    message_type = user_input.get("message_type", "chat")
    chat_history = state["chat_history"]
    current_plan = state.get("current_plan")

    publish(project_id, {"type": "agent_start", "role": "conductor"})

    # ── APPROVAL — structured signal from Approve button, no text scanning ──
    if message_type == "approval":
        if not current_plan:
            publish(project_id, {
                "type": "text_chunk",
                "chunk": "⚠️ No plan to approve yet. Tell me what to build!\n",
                "role": "conductor",
            })
            next_input = interrupt("waiting_for_user")
            return Command(goto="conductor", update={**state, "current_user_input": next_input})

        publish(project_id, {
            "type": "text_chunk", "chunk": "✅ Plan approved! Starting the build...\n", "role": "conductor",
        })
        new_state = {
            **state,
            "approved_plan": current_plan,
            "messages_to_save": list(state["messages_to_save"]) + [{
                "role": "conductor", "message_type": "conductor_text",
                "content": [{"type": "text", "content": "✅ Plan approved! Starting the build..."}],
            }],
        }
        publish(project_id, {"type": "done", "waiting_for": "build"})
        return Command(goto="artificer", update=new_state)


    # ── Normal conductor response (streaming) ─────────────────────
    SYSTEM = f"""You are a Conductor agent — the user's AI software architect and assistant.

PROJECT: {state["project_name"]}
DESCRIPTION: {state.get("project_description") or "No description yet"}
CURRENT PLAN: {json.dumps(current_plan, indent=2) if current_plan else "No plan yet"}

RULES:
1. BUILD/CREATE/ADD/MODIFY/IMPLEMENT request → generate or UPDATE the plan artifact below
2. Question/chat/advice → reply conversationally, NO artifact
3. CHANGE to current plan → update the artifact with their requested changes

PLAN ARTIFACT — use EXACTLY this JSON inside the markers when creating/updating a plan:
{ARTIFACT_START}
{{
  "artifact_type": "plan",
  "title": "Short descriptive title",
  "content": {{
    "status": "pending_approval",
    "overview": "High-level overview of the app and its features",
    "tech_stack": {{
      "language": "python",
      "framework": "fastapi",
      "database": "postgresql"
    }},
    "architecture": {{
      "diagram": "flowchart TD; A[User] --> B[Conductor]; B --> C[Artificer]; C --> D[Guardian]; D --> E[Deployer];",
      "content": "Description of the system architecture and component relationships"
    }},
    "database_schemas": {{
      "users": {{
        "id": "UUID",
        "email": "VARCHAR",
        "username": "VARCHAR",
        "onboardingCompleted": "BOOLEAN"
      }},
      "projects": {{
        "id": "UUID",
        "name": "VARCHAR",
        "description": "TEXT",
        "ownerId": "UUID"
      }}
    }},
    "endpoints": [
      {{
        "path": "/api/users",
        "method": "GET",
        "description": "Fetch all users"
      }},
      {{
        "path": "/api/projects",
        "method": "GET",
        "description": "Fetch all projects"
      }}
    ]
  }}
}}
{ARTIFACT_END}

After showing a plan ALWAYS end with:
"Review the plan above. Request any changes or say **APPROVE** to start the build."
"""

    ai_messages       = chat_history + [{"role": "user", "content": user_message}]
    blocks, artifacts = _stream_conductor(project_id, SYSTEM, ai_messages)

    text_content = " ".join(b["content"] for b in blocks if b["type"] == "text")
    new_history  = (chat_history + [
        {"role": "user", "content": user_message},
        {"role": "assistant", "content": text_content},
    ])[-40:]

    new_state = {
        **state,
        "chat_history": new_history,
        "artifacts":    list(state["artifacts"]) + artifacts,
        "messages_to_save": list(state["messages_to_save"]) + [{
            "role": "conductor",
            "message_type": "conductor_plan" if any(a.get("artifact_type") == "plan" for a in artifacts) else "conductor_text",
            "content": blocks,
        }],
    }

    plan_artifact = next((a for a in artifacts if a.get("artifact_type") == "plan"), None)
    if plan_artifact:
        new_state["current_plan"] = plan_artifact.get("content", {})

    publish(project_id, {"type": "done", "waiting_for": "user_input"})
    next_input = interrupt("waiting_for_user")
    new_state["current_user_input"] = next_input
    return Command(goto="conductor", update=new_state)

# ═══════════════════════════════════════════════════════════════════
# NODE 2 — ARTIFICER (write mode + fix mode)
# ReAct agent with Docker tools.
# ═══════════════════════════════════════════════════════════════════

def artificer_node(state: GraphState) -> GraphState:
    project_id    = state["project_id"]
    build_id      = state["build_id"]
    approved_plan = state["approved_plan"] or {}
    is_fix_mode   = len(state.get("security_issues", [])) > 0

    # ── VALIDATION: Ensure approved_plan has correct structure ────
    if approved_plan and "artifact_type" in approved_plan:
        # CRITICAL: approved_plan should be the content dict, not the full artifact
        # If we see "artifact_type", something went wrong in conductor_node
        raise ValueError(
            f"approved_plan has incorrect structure — contains 'artifact_type' key. "
            f"Expected content dict only. Keys: {list(approved_plan.keys())}"
        )

    publish(project_id, {
        "type":  "agent_start",
        "role":  "artificer",
        "extra": "fix mode" if is_fix_mode else "write mode",
    })

    # ── Get tech stack info from approved_plan ─────────────────────
    tech_stack = approved_plan.get("tech_stack", {})
    language   = tech_stack.get("language", "python").lower()
    framework  = tech_stack.get("framework", "fastapi").lower()
    
    # ── Docker: spin up fresh (write) or reattach (fix) ───────────
    if not is_fix_mode:
        # Determine port based on tech stack
        port = 8080  # Default
        if framework == "flask":
            port = 5000
        elif framework in ["express", "nextjs", "react"]:
            port = 3000
        elif framework == "django":
            port = 8000
        
        docker = DockerManager(project_id=project_id, build_id=build_id)
        docker.spin_up(port)
        publish(project_id, {
            "type":  "text_chunk", 
            "chunk": f"🐳 Build environment ready for {language}/{framework} on port {port}\n",
            "role":  "system",
        })
    else:
        # For fix mode, we need to reattach to existing container
        # The artificer will figure out how to rebuild/restart the app
        docker = DockerManager.reattach(build_id)
        # Kill any running app process so we can restart after fixes
        docker.exec("pkill -f 'uvicorn\\|node\\|python.*app\\|java' 2>/dev/null; sleep 1; true")

    # ── Prepare tools for the agent ─────────────────────
    tools = get_docker_tools(docker)

    # ── Build system prompt based on mode ─────────────────────────
    if not is_fix_mode:
        SYSTEM = f"""You are an Artificer agent — you write complete, production-quality code.

APPROVED PLAN:
{json.dumps(approved_plan, indent=2)}

YOUR MISSION:
Implement the entire application based on the plan. You have complete autonomy over:
- File structure and naming
- Dependencies and package management  
- Build processes and commands
- Port configuration and startup
- Database setup and migrations

TECH STACK: {language.title()} + {framework.title()}

STRICT RULES:
- Every file must be COMPLETE — no placeholders, no TODO comments
- Always include dependency files (requirements.txt, package.json, etc.) with ALL dependencies pinned
- Always include a Dockerfile that works for this tech stack
- Always add a GET /health endpoint that returns {{"status": "ok"}}
- Read ALL secrets from os.environ — NEVER hardcode credentials
- Choose appropriate port (8080 for Python/Java, 3000 for Node.js, etc.)
- Implement ALL endpoints from the plan specification

WORKFLOW — be intelligent and adaptive:
1. Analyze the tech stack and plan requirements
2. Create appropriate project structure for {framework}
3. Write all application files with write_file() 
4. Create appropriate dependency management files
5. Write a proper Dockerfile for the tech stack
6. Use check_syntax() to verify files after writing
7. Install dependencies using appropriate commands for {language}/{framework}
8. Start the application using exec_command() with appropriate start command
9. Verify the app is running and /health endpoint is accessible

STARTING THE APP:
- Kill any existing processes first: exec_command("pkill -f 'uvicorn|node|python.*app|java' 2>/dev/null || true")
- Use nohup to start in background: exec_command("nohup <start_command> > /workspace/app.log 2>&1 &")
- Wait a few seconds then test: exec_command("sleep 3 && curl -f http://localhost:<port>/health")
- Report success with the URL: "✅ App running at http://localhost:<port>"

IMPORTANT: You decide the build and run commands based on best practices for {language}/{framework}.
The system will automatically discover your choices and use them for deployment.

DO NOT ask for run configurations — figure them out yourself based on the tech stack!
"""
        task = f"Implement the complete {framework} application from the plan. Choose all build/run configurations intelligently."

    else:
        # ── For fix mode, use RAG to get context on existing vulnerabilities ──
        rag = ProjectRAG(project_id)
        issues_text  = json.dumps(state["security_issues"], indent=2)
        codebase_ctx = rag.retrieve(
            "security vulnerabilities authentication SQL injection XSS CSRF", top_k=8
        )
        SYSTEM = f"""You are an Artificer agent fixing critical security vulnerabilities.

SECURITY ISSUES TO FIX:
{issues_text}

RELEVANT CODEBASE:
{codebase_ctx}

TECH STACK: {language.title()} + {framework.title()}

STRICT RULES:
- Fix EVERY issue in the list above — do not skip any
- Read each file with read_file() BEFORE modifying it
- Write COMPLETE updated files — never partial patches
- Add comment # SECURITY FIX: [type] directly above each changed line
- Verify syntax with check_syntax() after each changed file
- If you change dependencies, reinstall using appropriate commands for {language}/{framework}
- Report done when all fixes are applied and verified

DO NOT start the app — the build system handles that after you finish.
"""
        task = (
            f"Fix all {len(state['security_issues'])} security issues. "
            f"Read each affected file, apply the fix, verify syntax. Report done when complete."
        )

    # ── Run ReAct loop ────────────────────────────────────────────
    final_text, tool_calls = run_react_agent(
        project_id  = project_id,
        role        = "artificer",
        system      = SYSTEM,
        user_prompt = task,
        tools       = tools,
        max_iter    = 40,
    )

    # ── Extract app URL from agent's work ──
    # The agent should have started the app and reported the URL
    app_url = None
    for tool_call in tool_calls:
        output = tool_call.get("output", "")
        # Look for success messages with URLs
        if ("✅" in output and "running" in output.lower() and "http://localhost:" in output) or \
           ("App running at" in output and "http://localhost:" in output):
            import re
            urls = re.findall(r'http://localhost:\d+', output)
            if urls:
                app_url = urls[0]
                break
    
    # ── Fallback: use Docker port mapping ──
    if not app_url:
        framework = approved_plan.get("tech_stack", {}).get("framework", "fastapi")
        if hasattr(docker, 'app_port') and docker.app_port:
            app_url = f"http://localhost:{docker.app_port}"
        else:
            # Use default ports
            default_port = {"fastapi": 8080, "flask": 5000, "express": 3000, "nextjs": 3000, "django": 8000}.get(framework, 8080)
            app_url = f"http://localhost:{default_port}"
    
    state["app_url"] = app_url
    publish(project_id, {
        "type":  "text_chunk",
        "chunk": f"🚀 Build complete. App available at {app_url}\n", 
        "role":  "system",
    })

    # ── Save message ──────────────────────────────────────────────
    state["messages_to_save"] = list(state["messages_to_save"]) + [{
        "role":         "artificer",
        "message_type": "conductor_text",
        "content":      [{"type": "text", "content": final_text}],
    }]

    # Clear current round security_issues — Guardian will populate fresh ones
    state["security_issues"] = []

    return state


# ═══════════════════════════════════════════════════════════════════
# NODE 3 — GUARDIAN
# ReAct agent with security attack tools.
# ═══════════════════════════════════════════════════════════════════

def guardian_node(state: GraphState) -> GraphState:
    project_id = state["project_id"]
    build_id   = state["build_id"]
    app_url    = state.get("app_url", "")
    iteration  = state["security_iteration"] + 1

    publish(project_id, {
        "type":  "agent_start",
        "role":  "guardian",
        "extra": f"scan #{iteration}",
    })
    publish(project_id, {
        "type":  "text_chunk",
        "chunk": f"\n🛡️ Guardian Security Scan #{iteration}\n",
        "role":  "guardian",
    })

    # Reattach Docker for source code reading
    approved_plan = state["approved_plan"] or {}
    tech_stack = approved_plan.get("tech_stack", {})
    docker = DockerManager.reattach(build_id)
    tools  = get_security_tools(docker, app_url)

    SYSTEM = f"""You are a Guardian agent — an elite security researcher and penetration tester.

TARGET APP: {app_url}
SECURITY SCAN: #{iteration}

YOUR MISSION:
Attack this application thoroughly. Find every security vulnerability before it reaches production.

ATTACK CHECKLIST — you MUST test all of these using your tools:

1.  SQL Injection         → run_sql_injection_scan() on /auth/login and any endpoint with user input
2.  Authentication bypass → run_auth_bypass_scan() on all protected endpoints
3.  XSS                   → http_request() POST with <script>alert(1)</script> in text inputs
4.  IDOR                  → http_request() GET /users/1, /users/2, change IDs to access other data
5.  Rate limiting         → run_rate_limit_scan() on /auth/login
6.  Security headers      → check_security_headers() on root endpoint
7.  Sensitive data leak   → http_request() trigger errors, check if stack traces exposed
8.  Broken access control → http_request() GET /admin or /dashboard without auth
9.  Path traversal        → http_request() GET with ../../../etc/passwd in path params
10. Code review           → read_source_file() on main files to find logic flaws

WORKFLOW:
1. list_source_files() to understand the project structure
2. read_source_file() on the main app file to understand routing
3. check_security_headers() — quick win
4. Work through the attack checklist above systematically
5. For each finding: document the file, line, attack payload, and required fix

After completing ALL tests, your final response MUST include the security report artifact:

{ARTIFACT_START}
{{
  "artifact_type": "security_report",
  "title": "Security Scan #{iteration} Results",
  "content": {{
    "iteration": {iteration},
    "app_url":   "{app_url}",
    "vulnerabilities_found": [
      {{
        "id":             "VULN-001",
        "severity":       "critical",
        "type":           "SQL Injection",
        "location":       "main.py line 42 — POST /auth/login",
        "description":    "User input passed directly to SQL query without parameterisation",
        "attack_payload": "' OR 1=1 --",
        "fix_required":   "Use parameterised queries via SQLAlchemy ORM"
      }}
    ],
    "passed_checks": [
      "Passwords hashed with bcrypt",
      "JWT tokens validated on all protected routes"
    ],
    "overall_status": "vulnerable",
    "summary": "Found N critical issues requiring immediate remediation before deployment."
  }}
}}
{ARTIFACT_END}

If NO vulnerabilities found: set vulnerabilities_found to [] and overall_status to "secure".
Be exhaustive — this app will handle real users and real data.
"""

    final_text, tool_calls = run_react_agent(
        project_id  = project_id,
        role        = "guardian",
        system      = SYSTEM,
        user_prompt = f"Run complete security scan #{iteration} on {app_url}. Test every attack vector. Output the security report artifact when done.",
        tools       = tools,
        max_iter    = 30,
    )

    # ── Parse security report artifact from final_text ────────────
    issues:    list[dict] = []
    is_secure: bool       = True

    if ARTIFACT_START in final_text and ARTIFACT_END in final_text:
        try:
            raw     = final_text.split(ARTIFACT_START)[1].split(ARTIFACT_END)[0].strip()
            report  = json.loads(raw)
            content = report.get("content", {})
            issues  = content.get("vulnerabilities_found", [])
            is_secure = (
                content.get("overall_status") == "secure"
                or len(issues) == 0
            )

            temp_id = str(uuid.uuid4())
            state["artifacts"] = list(state["artifacts"]) + [{
                "temp_id":       temp_id,
                "artifact_type": "security_report",
                "title":         report.get("title", f"Security Scan #{iteration}"),
                "content":       content,
            }]
            # Save message with embedded artifact
            clean_text = final_text.split(ARTIFACT_START)[0].strip()
            state["messages_to_save"] = list(state["messages_to_save"]) + [{
                "role":         "guardian",
                "message_type": "system_event",
                "content": [
                    {"type": "text",     "content": clean_text},
                    {"type": "artifact", "artifact_id": temp_id},
                ],
            }]
        except (json.JSONDecodeError, IndexError, KeyError):
            # Artifact parsing failed — treat as inconclusive
            is_secure  = False
            issues     = [{"severity": "high", "type": "Parse Error", "fix_required": "Guardian report could not be parsed — manual review required"}]
            state["messages_to_save"] = list(state["messages_to_save"]) + [{
                "role":         "guardian",
                "message_type": "system_event",
                "content":      [{"type": "text", "content": final_text}],
            }]
    else:
        # No artifact in response — infer from text
        is_secure = (
            "no vulnerabilities" in final_text.lower()
            or "all checks passed" in final_text.lower()
            or ("secure" in final_text.lower() and "vulnerable" not in final_text.lower())
        )
        state["messages_to_save"] = list(state["messages_to_save"]) + [{
            "role":         "guardian",
            "message_type": "system_event",
            "content":      [{"type": "text", "content": final_text}],
        }]

    state["security_iteration"]  = iteration
    state["security_issues"]     = issues
    state["all_security_issues"] = list(state.get("all_security_issues", [])) + issues

    if is_secure:
        publish(project_id, {
            "type":  "text_chunk",
            "chunk": f"\n✅ Scan #{iteration} complete — no vulnerabilities found! Preparing deployment.\n",
            "role":  "guardian",
        })
    else:
        publish(project_id, {
            "type":  "text_chunk",
            "chunk": f"\n⚠️ Scan #{iteration}: found {len(issues)} issue(s). Sending to Artificer for fixes...\n",
            "role":  "guardian",
        })

    return state


# ═══════════════════════════════════════════════════════════════════
# NODE 4 — DEPLOYER
# Intelligent agent that analyzes the built code and deploys via Railway.
# Works with build_task.py for credential handling and actual deployment.
# ═══════════════════════════════════════════════════════════════════

def deployer_node(state: GraphState) -> GraphState:
    project_id    = state["project_id"]
    build_id      = state["build_id"]
    approved_plan = state["approved_plan"] or {}
    deploy_payload = state.get("deploy_payload")

    # ── VALIDATION: Ensure approved_plan has correct structure ────
    if approved_plan and "artifact_type" in approved_plan:
        raise ValueError(
            f"approved_plan has incorrect structure — contains 'artifact_type' key. "
            f"Expected content dict only. Keys: {list(approved_plan.keys())}"
        )

    publish(project_id, {
        "type":  "agent_start",
        "role":  "deployer",
        "extra": "analyzing codebase for deployment",
    })

    # ── Check if this is the initial deployment analysis or post-env-vars ──
    if not deploy_payload:
        # First time — analyze the codebase and determine what env vars are needed
        
        # Reattach to Docker to examine the built application
        docker = DockerManager.reattach(build_id, None)  # No run_config needed
        
        # Get deployment analysis tools (read-only)
        from app.agents.tools.docker_tools import get_docker_tools
        tools = get_docker_tools(docker)
        
        publish(project_id, {
            "type":  "text_chunk", 
            "chunk": "🔍 Analyzing codebase to determine deployment requirements...\n",
            "role":  "deployer",
        })

        SYSTEM = f"""You are a Deployer agent — an expert at analyzing applications and determining deployment needs.

PROJECT: {state["project_name"]}
TECH STACK: {json.dumps(approved_plan.get("tech_stack", {}), indent=2)}

YOUR MISSION:
Analyze the built application to determine what environment variables are needed for deployment.

ANALYSIS STEPS:
1. list_files() — see the complete project structure
2. read_file() the main application files (main.py, app.py, index.js, etc.)
3. read_file() any configuration files (settings.py, config.js, .env.example, etc.)
4. Look for patterns like:
   - os.environ.get("DATABASE_URL")
   - process.env.STRIPE_KEY
   - config.SECRET_KEY
   - Any database connection strings
   - API keys and secrets
   - Port configurations

IDENTIFY THESE CATEGORIES:
1. **Database**: DATABASE_URL, POSTGRES_URL, MONGODB_URI, etc.
2. **Secrets**: SECRET_KEY, JWT_SECRET, ENCRYPTION_KEY, etc.
3. **APIs**: STRIPE_KEY, SENDGRID_API_KEY, OPENAI_API_KEY, etc.
4. **URLs**: FRONTEND_URL, API_BASE_URL, WEBHOOK_URL, etc.

After analysis, provide your findings in this exact format:
```
DEPLOYMENT ANALYSIS COMPLETE

Environment Variables Required:
- DATABASE_URL (Database connection string)
- SECRET_KEY (Application secret key)
- STRIPE_KEY (Payment processing)
- FRONTEND_URL (Frontend application URL)

Files Analyzed:
- main.py (FastAPI app with database models)
- settings.py (Configuration with env var references)
- requirements.txt (Dependencies include stripe, psycopg2)

Ready for environment variable collection.
```
"""

        final_text, tool_calls = run_react_agent(
            project_id  = project_id,
            role        = "deployer",
            system      = SYSTEM,
            user_prompt = "Analyze the built application and determine what environment variables are needed for deployment.",
            tools       = tools,
            max_iter    = 15,
        )

        # Parse environment variables from the analysis
        env_vars_needed = []
        if "Environment Variables Required:" in final_text:
            try:
                # Extract the env vars section
                lines = final_text.split("Environment Variables Required:")[1].split("Files Analyzed:")[0].strip().split('\n')
                for line in lines:
                    line = line.strip()
                    if line.startswith('- '):
                        # Parse: "- DATABASE_URL (Database connection string)"
                        parts = line[2:].split(' (', 1)
                        name = parts[0].strip()
                        description = parts[1].rstrip(')') if len(parts) > 1 else f"Configuration for {name}"
                        env_vars_needed.append({
                            "name": name,
                            "description": description,
                            "required": True
                        })
            except Exception:
                # Fallback to common env vars based on tech stack
                tech_stack = approved_plan.get("tech_stack", {})
                if tech_stack.get("database") in ["postgresql", "postgres"]:
                    env_vars_needed.append({"name": "DATABASE_URL", "description": "PostgreSQL connection string", "required": True})
                env_vars_needed.append({"name": "SECRET_KEY", "description": "Application secret key", "required": True})

        # Create env var request artifact
        temp_id = str(uuid.uuid4())
        state["artifacts"] = list(state["artifacts"]) + [{
            "temp_id":       temp_id,
            "artifact_type": "env_var_request",
            "title":         "Environment Variables Required for Deployment",
            "content": {
                "build_id":        build_id,
                "status":          "waiting_for_env_vars",
                "env_vars_needed": env_vars_needed,
                "analysis":        final_text,
                "message":         (
                    "✅ Security testing complete! Codebase analyzed for deployment.\n\n"
                    f"Found {len(env_vars_needed)} environment variables needed.\n"
                    "Please provide your environment variables to proceed with deployment.\n\n"
                    "Your values are encrypted in the browser — we never see the plaintext."
                ),
            },
        }]
        
        state["messages_to_save"] = list(state["messages_to_save"]) + [{
            "role":         "deployer",
            "message_type": "system_event", 
            "content": [
                {"type": "text",     "content": final_text},
                {"type": "artifact", "artifact_id": temp_id},
            ],
        }]
        
        publish(project_id, {
            "type":          "artifact",
            "artifact_id":   temp_id,
            "artifact_data": {
                "artifact_type": "env_var_request",
                "title":         "Environment Variables Required for Deployment",
                "content":       {
                    "env_vars_needed": env_vars_needed, 
                    "build_id": build_id,
                    "analysis": final_text
                },
            },
            "role": "deployer",
        })
        
        publish(project_id, {"type": "done", "waiting_for": "env_vars"})

        # ── INTERRUPT — pause, save state, wait for deploy_confirm_task ──
        deploy_payload = interrupt("waiting_for_env_vars")
        state["deploy_payload"] = deploy_payload

    # ── Handle Railway connection and deployment credentials ──────
    # This section is reached after deploy_confirm_task resumes the graph
    
    # Check if we need to handle Railway connection first
    railway_connected = deploy_payload.get("railway_connected", False)
    stage = deploy_payload.get("stage", "railway_check")
    
    if stage == "railway_check" and not railway_connected:
        # Deploy payload is missing Railway key — trigger Railway connect flow
        # This shouldn't happen if build_task.py is working correctly, but handle gracefully
        publish(project_id, {
            "type":  "text_chunk",
            "chunk": "🚂 Railway connection required. Redirecting to Railway setup...\n", 
            "role":  "deployer",
        })
        
        temp_id = str(uuid.uuid4())
        state["artifacts"] = list(state["artifacts"]) + [{
            "temp_id":       temp_id,
            "artifact_type": "connect_railway",
            "title":         "Connect Railway to Deploy",
            "content": {
                "build_id": build_id,
                "status":   "waiting_for_railway_key",
                "message":  (
                    "🚂 Almost there! Your app is built and security-tested.\n\n"
                    "To deploy, connect your Railway account once.\n"
                    "Future deployments are fully automatic — you'll never be asked again.\n\n"
                    "Get your token: railway.app → Account Settings → Tokens"
                ),
            },
        }]
        
        publish(project_id, {
            "type":          "artifact",
            "artifact_id":   temp_id, 
            "artifact_data": {
                "artifact_type": "connect_railway",
                "title":         "Connect Railway to Deploy",
                "content": {"build_id": build_id, "status": "waiting_for_railway_key"},
            },
            "role": "system",
        })
        
        publish(project_id, {"type": "done", "waiting_for": "railway_key"})
        
        # Wait for Railway connection
        deploy_payload = interrupt("waiting_for_railway_key")
        state["deploy_payload"] = deploy_payload

    # ── Actual deployment phase ──────────────────────────────────
    # deploy_payload now contains all credentials from build_task.py
    
    plaintext_vars = deploy_payload.get("plaintext_vars", {})
    github_token   = deploy_payload.get("github_token", "")
    railway_api_key = deploy_payload.get("railway_api_key", "")

    if not github_token:
        state["error"] = "GitHub token missing from deploy payload"
        publish(project_id, {
            "type":  "text_chunk",
            "chunk": "❌ GitHub token not provided. Cannot deploy.\n",
            "role":  "deployer",
        })
        return state
        
    if not railway_api_key:
        state["error"] = "Railway API key missing from deploy payload" 
        publish(project_id, {
            "type":  "text_chunk",
            "chunk": "❌ Railway API key not provided. Cannot deploy.\n",
            "role":  "deployer",
        })
        return state

    # Reattach Docker for deployment
    docker = DockerManager.reattach(build_id, None)

    # Get deployment tools
    from app.agents.tools.deploy_tools import get_deploy_tools
    tools = get_deploy_tools(
        docker          = docker,
        github_token    = github_token,
        railway_api_key = railway_api_key,
    )

    project_slug = f"nexus-{project_id[:8]}"
    env_vars_json = json.dumps(plaintext_vars)

    publish(project_id, {
        "type":  "text_chunk",
        "chunk": f"🚀 Deploying {state['project_name']} to Railway...\n",
        "role":  "deployer",
    })

    SYSTEM = f"""You are a Deployer agent — you push code to GitHub and deploy it to Railway.

PROJECT: {state["project_name"]}
REPO/SERVICE NAME: {project_slug}
TECH STACK: {json.dumps(approved_plan.get("tech_stack", {}), indent=2)}

ENV VARS TO DEPLOY WITH:
{env_vars_json}

YOUR MISSION:
Deploy this application to Railway. The codebase has already been built and tested.

DEPLOYMENT WORKFLOW:
1. create_github_repo("{project_slug}", description="{state['project_name']}")
   - If repo exists, that's fine — note the URLs and proceed
   
2. push_to_github(clone_url=<from step 1>, commit_message="Deploy from NexusAI Build #{build_id}")
   - Push all files from the Docker container to GitHub
   - Handle any authentication or push issues
   
3. deploy_to_railway(repo_url=<html_url from step 1>, project_name="{project_slug}", env_vars='{env_vars_json}')
   - Deploy to Railway using the GitHub repo
   - Pass all environment variables
   
4. check_deploy_status() and wait_for_deploy() until live
   
5. Report the final live URL

IMPORTANT:
- All credentials are already provided via tools
- Read package.json/requirements.txt to understand the start command
- If deployment fails, read the logs and try to fix the issue
- Railway will auto-detect the framework and build process
"""

    final_text, tool_calls = run_react_agent(
        project_id  = project_id,
        role        = "deployer",
        system      = SYSTEM,
        user_prompt = f"Deploy {state['project_name']} to Railway. Follow the workflow: GitHub repo → push code → Railway deploy → confirm live.",
        tools       = tools,
        max_iter    = 25,
    )

    # ── Extract URLs from all tool call outputs ────────────────────
    repo_url:   Optional[str] = None
    deploy_url: Optional[str] = None

    for tc in tool_calls:
        output = tc.get("output", "")
        if "html_url=" in output:
            try:
                repo_url = output.split("html_url=")[1].split()[0].strip()
            except IndexError:
                pass
        if "url=https://" in output:
            try:
                deploy_url = "https://" + output.split("url=https://")[1].split()[0].strip()
            except IndexError:
                pass

    state["repo_url"]   = repo_url
    state["deploy_url"] = deploy_url

    # ── CRITICAL: wipe credentials from state ─────────────────────
    state["deploy_payload"] = None

    # ── Spin down Docker — files are in GitHub now ─────────────────
    try:
        docker.spin_down()
    except Exception:
        pass

    # ── Deployment artifact ───────────────────────────────────────
    temp_id = str(uuid.uuid4())
    state["artifacts"] = list(state["artifacts"]) + [{
        "temp_id":       temp_id,
        "artifact_type": "deployment",
        "title":         "Deployment Complete" if deploy_url else "Deployment Attempted",
        "content": {
            "provider":            "railway",
            "url":                 deploy_url,
            "repo_url":            repo_url,
            "status":              "live"    if deploy_url else "unknown",
            "security_iterations": state["security_iteration"],
            "total_issues_fixed":  len(state.get("all_security_issues", [])),
            "project_slug":        project_slug,
            "env_vars_count":      len(plaintext_vars),
        },
    }]
    
    final_msg = f"🎉 Successfully deployed to {deploy_url}!" if deploy_url else "⚠️ Deployment attempted — check logs for status."
    state["messages_to_save"] = list(state["messages_to_save"]) + [{
        "role":         "deployer",
        "message_type": "system_event",
        "content": [
            {"type": "text",     "content": final_text},
            {"type": "artifact", "artifact_id": temp_id},
        ],
        "metadata": {
            "event":      "deployment_complete",
            "url":        deploy_url,
            "repo_url":   repo_url,
            "build_id":   build_id,
        },
    }]

    publish(project_id, {
        "type":          "artifact",
        "artifact_id":   temp_id,
        "artifact_data": {
            "artifact_type": "deployment",
            "title":         "Deployment Complete" if deploy_url else "Deployment Attempted",
            "content": {
                "provider": "railway",
                "url": deploy_url,
                "repo_url": repo_url,
                "status": "live" if deploy_url else "unknown",
            },
        },
        "role": "deployer",
    })
    
    publish(project_id, {
        "type":       "done",
        "deploy_url": deploy_url,
        "repo_url":   repo_url,
    })
    return state


# ═══════════════════════════════════════════════════════════════════
# ROUTING — after Guardian, go to Artificer (fix) or Deployer (clean)
# ═══════════════════════════════════════════════════════════════════

def route_after_guardian(state: GraphState) -> str:
    issues    = state.get("security_issues", [])
    iteration = state.get("security_iteration", 0)
    max_iter  = settings.MAX_SECURITY_ITERATIONS

    if not issues:
        return "deployer"   # clean — ship it

    if iteration >= max_iter:
        publish(state["project_id"], {
            "type":  "text_chunk",
            "chunk": f"\n⚠️ Max security iterations ({max_iter}) reached. Proceeding to deploy with warnings.\n",
            "role":  "system",
        })
        return "deployer"

    return "artificer"   # fix issues, re-test


# ═══════════════════════════════════════════════════════════════════
# COMPILE GRAPH
# ═══════════════════════════════════════════════════════════════════

def create_workflow(db_sync_url: str):
    """
    Build and compile the LangGraph workflow with PostgreSQL checkpointer.
    The checkpointer saves full GraphState between every interrupt — enabling:
      - Human-in-the-loop at conductor (wait for user message)
      - Human-in-the-loop at deployer (wait for env vars)
      - Worker crash recovery (resume from last saved state)
    """
    graph = StateGraph(GraphState)

    graph.add_node("conductor", conductor_node)
    graph.add_node("artificer", artificer_node)
    graph.add_node("guardian",  guardian_node)
    graph.add_node("deployer",  deployer_node)

    graph.set_entry_point("conductor")

    graph.add_edge("artificer", "guardian")
    graph.add_conditional_edges(
        "guardian",
        route_after_guardian,
        {"artificer": "artificer", "deployer": "deployer"},
    )
    graph.add_edge("deployer", END)

    checkpointer = PostgresSaver.from_conn_string(db_sync_url)
    checkpointer.setup()

    return graph.compile(
        checkpointer     = checkpointer,
        interrupt_before = ["conductor"],
    )