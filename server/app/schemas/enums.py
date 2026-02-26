"""
Shared enums — single source of truth for both frontend and backend.
Mirrors: client/types/workflow.ts (WorkflowStage, UserAction)
"""

from enum import Enum


class WorkflowStage(str, Enum):
    """
    Maps 1-to-1 with the frontend WorkflowStage type.
    See: client/types/workflow.ts
    """
    IDLE        = "idle"           # No workflow running yet
    PLANNING    = "planning"       # Conductor is generating plan (streaming)
    PLAN_REVIEW = "plan_review"    # Plan ready — waiting for user to approve/edit
    BUILDING    = "building"       # Artificer is writing code
    TESTING     = "testing"        # Guardian is running security checks
    FIXING      = "fixing"         # Artificer is fixing issues found by Guardian
    DEPLOYING   = "deploying"      # Deployer is running
    WAITING_ENV = "waiting_env"    # Deployer waiting for user env vars
    COMPLETE    = "complete"       # Done
    ERROR       = "error"          # Something failed


class UserAction(str, Enum):
    """
    Explicit user actions sent from frontend.
    The backend NEVER infers intent from text content.
    See: client/types/workflow.ts UserAction type
    """
    REQUEST_PLAN     = "request_plan"      # Plan button
    DIRECT_BUILD     = "direct_build"      # Build Now button
    APPROVE_PLAN     = "approve_plan"      # Approve button on plan card
    EDIT_PLAN        = "edit_plan"         # Save edits on plan card
    SEND_MESSAGE     = "send_message"      # Regular chat
    PROVIDE_ENV_VARS = "provide_env_vars"  # Deploy env vars form


class MessageType(str, Enum):
    """
    Internal message_type used by the conductor node to route actions.
    Mapped from UserAction by message_routes.py — never exposed to frontend.
    """
    REQUEST_PLAN = "request_plan"
    DIRECT_BUILD = "direct_build"
    APPROVAL     = "approval"
    EDIT_PLAN    = "edit_plan"
    CHAT         = "chat"


# ── UserAction → MessageType mapping ─────────────────────────────
# Single source of truth. Used in message_routes.py.
ACTION_TO_MESSAGE_TYPE: dict[UserAction, MessageType] = {
    UserAction.REQUEST_PLAN:     MessageType.REQUEST_PLAN,
    UserAction.DIRECT_BUILD:     MessageType.DIRECT_BUILD,
    UserAction.APPROVE_PLAN:     MessageType.APPROVAL,
    UserAction.EDIT_PLAN:        MessageType.EDIT_PLAN,
    UserAction.SEND_MESSAGE:     MessageType.CHAT,
    # provide_env_vars is handled separately — not routed to conductor
}
