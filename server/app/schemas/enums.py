"""
Shared enums — single source of truth for both frontend and backend.
Mirrors: client/types/workflow.ts (WorkflowStage, UserAction)

PIPELINE v2 — No plan/approval. Agents have full autonomy.
"""

from enum import Enum


class WorkflowStage(str, Enum):
    """
    Maps 1-to-1 with the frontend WorkflowStage type.
    See: client/types/workflow.ts
    """
    IDLE        = "idle"           # No workflow running yet
    THINKING    = "thinking"       # Conductor is analysing the request
    BUILDING    = "building"       # Artificer is writing code
    TESTING     = "testing"        # Guardian is running security checks
    FIXING      = "fixing"         # Artificer is fixing issues found by Guardian
    DEPLOYING   = "deploying"      # Deployer is running
    WAITING_ENV = "waiting_env"    # Deployer waiting for user env vars
    COMPLETE    = "complete"       # Done
    ERROR       = "error"          # Something failed


class UserAction(str, Enum):
    """
    Only two user actions now.  The backend NEVER infers intent from text.
    """
    SEND_MESSAGE     = "send_message"      # Regular chat / build request
    PROVIDE_ENV_VARS = "provide_env_vars"  # Deploy env vars form


class MessageType(str, Enum):
    """
    Internal message_type used by the conductor node.
    With the simplified pipeline there is only one real type: CHAT.
    provide_env_vars is handled separately — never routed to conductor.
    """
    CHAT = "chat"


# ── UserAction → MessageType mapping ─────────────────────────────
ACTION_TO_MESSAGE_TYPE: dict[UserAction, MessageType] = {
    UserAction.SEND_MESSAGE: MessageType.CHAT,
    # provide_env_vars is handled separately — not routed to conductor
}
