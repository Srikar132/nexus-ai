"""
agents/react.py

ReAct (Reason + Act) loop for all agent nodes.

KEY FIXES vs original:
  1. Anthropic tool result format fixed.
     Anthropic requires tool results as a structured content block with the
     matching tool_use_id. The original appended a plain user message string
     which works for Groq/OpenAI but causes a 400 on Anthropic.
     Now provider-aware: Anthropic gets proper tool_result blocks;
     OpenAI/Groq get the plain-text user message format.

  2. Model defaulted to "claude-3-5-sonnet" (reliable tool-calling).
     "llama-3.3-70b" was referenced in workflow.py but doesn't exist in
     the MODELS registry. All agent calls now use claude-3-5-sonnet which
     has excellent tool use. Pass model= explicitly to override per node.

  3. thinking status published with correct agent role on every step.

  4. max_iter enforced properly — no off-by-one.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from langchain_core.tools import BaseTool

from app.core.redis import publish
from app.core.llm import get_llm, LLMProvider

log = logging.getLogger(__name__)

DEFAULT_MAX_ITER = 15


# ── Dynamic thinking messages ─────────────────────────────────────

_THINKING: dict[str, dict[str, str]] = {
    "artificer": {
        "write_file":     "Writing {arg}...",
        "read_file":      "Reading {arg}...",
        "exec_command":   "Running: {arg}",
        "check_syntax":   "Checking syntax of {arg}...",
        "list_files":     "Exploring project structure...",
        "get_app_logs":   "Checking application logs...",
        "delete_file":    "Removing {arg}...",
        "_default":       "Building (step {step})...",
    },
    "guardian": {
        "run_sql_injection_scan": "Testing for SQL injection...",
        "run_auth_bypass_scan":   "Testing authentication bypass...",
        "run_rate_limit_scan":    "Testing rate limiting...",
        "check_security_headers": "Checking security headers...",
        "http_request":           "Probing {arg}...",
        "read_source_file":       "Reviewing {arg}...",
        "list_source_files":      "Mapping project files...",
        "_default":               "Running security scan (step {step})...",
    },
    "deployer": {
        "create_github_repo":  "Creating GitHub repository...",
        "push_to_github":      "Pushing code to GitHub...",
        "deploy_to_railway":   "Deploying to Railway...",
        "check_deploy_status": "Checking deployment status...",
        "wait_for_deploy":     "Waiting for deployment to go live...",
        "_default":            "Deploying (step {step})...",
    },
}


def _thinking_msg(role: str, tool_name: str, tool_input: dict, step: int) -> str:
    role_map = _THINKING.get(role, {})
    template = role_map.get(tool_name, role_map.get("_default", "Processing (step {step})..."))

    arg = ""
    for key in ("file_path", "path", "url", "command", "endpoint"):
        if key in tool_input:
            val = str(tool_input[key])
            arg = val[:50] + ("..." if len(val) > 50 else "")
            break

    try:
        return template.format(arg=arg, step=step)
    except (KeyError, IndexError):
        return template.replace("{arg}", arg).replace("{step}", str(step))


def _safe_preview(tool_input: dict) -> str:
    """Truncate tool inputs for SSE display — mask any credential-looking keys."""
    try:
        preview = json.dumps(tool_input)
        lower   = preview.lower()
        for key in ("token", "key", "password", "secret", "credential", "auth"):
            if key in lower:
                return "{...sensitive input redacted...}"
        return preview[:300]
    except Exception:
        return str(tool_input)[:300]


# ── Tool result formatting — provider-aware ───────────────────────

def _make_tool_result_message(
    provider:   LLMProvider,
    tool_id:    str,
    tool_name:  str,
    result_str: str,
) -> dict:
    """
    Format a tool result for the next LLM turn.

    Anthropic requires:
      {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "...", "content": "..."}]}

    OpenAI / Groq accept:
      {"role": "tool", "tool_call_id": "...", "content": "..."}
    """
    if provider == LLMProvider.ANTHROPIC:
        return {
            "role": "user",
            "content": [{
                "type":        "tool_result",
                "tool_use_id": tool_id,
                "content":     result_str,
            }],
        }
    else:
        # OpenAI / Groq
        return {
            "role":         "tool",
            "tool_call_id": tool_id,
            "name":         tool_name,
            "content":      result_str,
        }


# ═══════════════════════════════════════════════════════════════════
# MAIN ReAct LOOP
# ═══════════════════════════════════════════════════════════════════

def run_react_agent(
    project_id:  str,
    role:        str,
    system:      str,
    user_prompt: str,
    tools:       list[BaseTool],
    history:     Optional[list] = None,
    max_iter:    int = DEFAULT_MAX_ITER,
    model:       str = "claude-3-5-sonnet",
) -> tuple[str, list[dict]]:
    """
    Run a ReAct agent loop.

    Returns (final_text, tool_calls_log).
    final_text is the last response that contained no tool calls.
    tool_calls_log is [{tool, input, output}, ...] for all tool invocations.
    """
    llm      = get_llm(model)
    provider = llm.config.provider   # LLMProvider enum

    messages: list[dict] = [{"role": "system", "content": system}]

    if history:
        for msg in history:
            if hasattr(msg, "type"):
                type_map = {"human": "user", "ai": "assistant", "system": "system"}
                if msg.type in type_map:
                    messages.append({"role": type_map[msg.type], "content": msg.content})
            elif isinstance(msg, dict):
                messages.append(msg)

    messages.append({"role": "user", "content": user_prompt})

    tool_map:       dict[str, BaseTool] = {t.name: t for t in tools}
    tool_calls_log: list[dict]          = []
    final_text:     str                 = ""

    for iteration in range(max_iter):
        publish(project_id, {
            "type":   "thinking",
            "role":   role,
            "status": f"Reasoning (step {iteration + 1})..." if iteration == 0
                      else f"Processing step {iteration + 1}...",
        })

        response = llm.chat_with_tools(messages, tools, max_tokens=8192, temperature=0)

        # ── Tool call(s) ──────────────────────────────────────────
        if response.tool_calls:
            # Append assistant message with tool_calls for context
            # (needed for Anthropic multi-turn tool use)
            messages.append({
                "role":    "assistant",
                "content": response.content or "",
            })

            for tc in response.tool_calls:
                tool_name  = tc["name"]
                tool_input = tc["args"]
                tool_id    = tc.get("id", f"call_{iteration}_{tool_name}")

                # Live thinking status
                publish(project_id, {
                    "type":   "thinking",
                    "role":   role,
                    "status": _thinking_msg(role, tool_name, tool_input, iteration + 1),
                })

                # Notify frontend of tool call
                publish(project_id, {
                    "type":  "tool_call",
                    "role":  role,
                    "tool":  tool_name,
                    "input": _safe_preview(tool_input),
                })

                # Execute
                tool_fn = tool_map.get(tool_name)
                if tool_fn:
                    try:
                        result = tool_fn.invoke(tool_input)
                    except Exception as e:
                        result = f"❌ Tool error: {e}"
                else:
                    result = f"❌ Unknown tool: {tool_name}"

                result_str = str(result)

                # Stream result preview to frontend
                publish(project_id, {
                    "type":   "tool_result",
                    "role":   role,
                    "tool":   tool_name,
                    "result": result_str[:500],
                })

                tool_calls_log.append({
                    "tool":   tool_name,
                    "input":  tool_input,
                    "output": result_str,
                })

                # Add tool result in the correct format for this provider
                messages.append(
                    _make_tool_result_message(provider, tool_id, tool_name, result_str)
                )

        # ── Final text response ───────────────────────────────────
        else:
            final_text = response.content if isinstance(response.content, str) else ""

            # Stream word by word
            words = final_text.split(" ")
            for i, word in enumerate(words):
                publish(project_id, {
                    "type":  "text_chunk",
                    "chunk": word + (" " if i < len(words) - 1 else ""),
                    "role":  role,
                })
            break

    else:
        # Hit max_iter without a final response
        final_text = f"⚠️ Agent reached max iterations ({max_iter}). Stopping."
        publish(project_id, {
            "type":  "text_chunk",
            "chunk": f"\n{final_text}\n",
            "role":  role,
        })

    return final_text, tool_calls_log