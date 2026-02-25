"""
agents/react.py

ReAct (Reason + Act) loop used inside every agent node.

Each agent:
1. Gets a system prompt describing its job
2. Gets a list of tools it can call
3. Loops: thinks → calls tool → sees result → thinks again
4. Until it decides it's done (no tool call in response)

Events are published to Redis as the agent works so frontend
receives live updates via SSE.

Max iterations prevents infinite loops.
"""
import json
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from langchain_core.tools import BaseTool
from app.core.redis import publish
from app.core.config import settings
from app.core.llm import get_llm

MAX_ITERATIONS = 15   # safety cap per agent run (callers can override via max_iter)


def run_react_agent(
    project_id:  str,
    role:        str,          # "conductor" | "artificer" | "guardian" | "deployer"
    system:      str,          # system prompt for this agent
    user_prompt: str,          # initial task description
    tools:       list[BaseTool],
    history:     list = None,  # optional prior messages for context
    max_iter:    int  = MAX_ITERATIONS,
    model:       str  = "llama-3.1-70b",  # Allow model selection
) -> tuple[str, list[dict]]:
    """
    Run a ReAct agent loop.

    Returns:
        final_text   — the agent's final text response (no tool call)
        tool_calls   — list of all tool calls made: [{tool, input, output}]
    """
    # Get unified LLM instance
    llm = get_llm(model)

    # Build message history in unified format
    messages = [{"role": "system", "content": system}]
    
    if history:
        # Convert LangChain messages to dict format if needed
        for msg in history:
            if hasattr(msg, 'type'):
                if msg.type == "system":
                    messages.append({"role": "system", "content": msg.content})
                elif msg.type == "human":
                    messages.append({"role": "user", "content": msg.content})
                elif msg.type == "ai":
                    messages.append({"role": "assistant", "content": msg.content})
                elif msg.type == "tool":
                    messages.append({"role": "user", "content": f"[Tool Result]: {msg.content}"})
            else:
                messages.append(msg)
    
    messages.append({"role": "user", "content": user_prompt})

    tool_map = {t.name: t for t in tools}
    tool_calls_log = []
    final_text = ""

    for iteration in range(max_iter):
        # Get response with tools
        response = llm.chat_with_tools(messages, tools, max_tokens=8096, temperature=0)
        
        # Add AI response to message history
        messages.append({"role": "assistant", "content": response.content})

        # ── Agent chose to use a tool ─────────────────────────────
        if response.tool_calls:
            for tc in response.tool_calls:
                tool_name  = tc["name"]
                tool_input = tc["args"]
                tool_id    = tc["id"]

                # Tell frontend what the agent is doing
                publish(project_id, {
                    "type":      "tool_call",
                    "role":      role,
                    "tool":      tool_name,
                    "input":     _safe_preview(tool_input),
                })

                # Execute tool
                tool_fn = tool_map.get(tool_name)
                if tool_fn:
                    try:
                        result = tool_fn.invoke(tool_input)
                    except Exception as e:
                        result = f"❌ Tool error: {e}"
                else:
                    result = f"❌ Unknown tool: {tool_name}"

                # Stream tool result to frontend
                publish(project_id, {
                    "type":   "tool_result",
                    "role":   role,
                    "tool":   tool_name,
                    "result": str(result)[:500],   # preview only
                })

                # Log it
                tool_calls_log.append({
                    "tool":   tool_name,
                    "input":  tool_input,
                    "output": str(result),
                })

                # Add tool result to messages so agent can reason about it
                messages.append({
                    "role": "user", 
                    "content": f"[Tool Result] Tool '{tool_name}' returned: {str(result)}"
                })

        # ── Agent gave a final text response (no tool call) ───────
        else:
            final_text = response.content if isinstance(response.content, str) else ""

            # Stream final text word by word (approximate — split by spaces)
            words = final_text.split(" ")
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                publish(project_id, {
                    "type":  "text_chunk",
                    "chunk": chunk,
                    "role":  role,
                })
            break

    else:
        # Hit max iterations — force stop
        final_text = f"⚠️ Agent reached max iterations ({max_iter}). Stopping."
        publish(project_id, {
            "type":  "text_chunk",
            "chunk": f"\n{final_text}\n",
            "role":  role,
        })

    return final_text, tool_calls_log


def _safe_preview(tool_input: dict) -> str:
    """Truncate tool inputs for frontend display — don't expose secrets"""
    try:
        preview = json.dumps(tool_input)
        # Mask anything that looks like a token or key
        for key in ("token", "key", "password", "secret", "credential"):
            if key in preview.lower():
                return f"{{...sensitive input...}}"
        return preview[:200]
    except Exception:
        return str(tool_input)[:200]