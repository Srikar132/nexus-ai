/**
 * types/workflow.ts
 *
 * KEY FIXES:
 *  1. build_failed added to SSEEvent — backend emits this on Celery task failure.
 *     Without it, TypeScript doesn't narrow the type and the store switch()
 *     can't handle it cleanly.
 *
 *  2. done event now includes optional deploy_url and repo_url — the backend
 *     deplyer node publishes these on the final "done" event so the sidebar
 *     can display the live URL without a separate API call.
 *
 *  3. WorkflowStage "thinking" aligned — backend publishes type="thinking"
 *     as a ThinkingEvent (not stage_change), so "thinking" as a stage is only
 *     set by the store internally. Kept in the union for type safety.
 *
 *  4. UserAction — provide_env_vars maps directly to POST /messages with
 *     action="provide_env_vars". No separate deployConfirm action needed.
 */

// ─── Stage ────────────────────────────────────────────────────────────────────

export type WorkflowStage =
  | "idle"         // No workflow running
  | "thinking"     // Conductor analyzing (set internally when thinking event arrives)
  | "building"     // Artificer writing code
  | "testing"      // Guardian running security checks
  | "fixing"       // Artificer fixing security issues
  | "deploying"    // Deployer running
  | "waiting_env"  // Deployer waiting for user env vars
  | "complete"     // Successfully deployed
  | "error";       // Something failed

// ─── SSE Events ───────────────────────────────────────────────────────────────

export type SSEEvent =
  | { type: "stage_change"; stage: WorkflowStage }
  | { type: "thinking";     status: string; role: string }
  | { type: "agent_start";  role: string }
  | { type: "agent_done";   role: string }
  | { type: "text_chunk";   chunk: string; role: string }
  | { type: "artifact";     artifact_type: string; title: string; content: unknown }
  | { type: "tool_call";    role: string; tool: string; input: string }
  | { type: "tool_result";  role: string; tool: string; result: string }
  | { type: "file_created"; path: string; content: string; lines: number; size: number }
  | { type: "file_deleted"; path: string }
  | { type: "done";         deploy_url?: string; repo_url?: string; status?: string }
  | { type: "close_stream" }  // Signals end of entire workflow session
  | { type: "build_failed"; reason: string }
  | { type: "error";        message: string };

// ─── Messages ─────────────────────────────────────────────────────────────────

export type MessageRole =
  | "user"
  | "conductor"
  | "artificer"
  | "guardian"
  | "deployer"
  | "system";

export interface Message {
  id:           string;
  role:         MessageRole;
  message_type: string;
  content: Array<
    | { type: "text";     content: string }
    | {
        type:          "artifact";
        artifact_id:   string;
        artifact_data?: {
          artifact_type: string;
          title:         string;
          content:       unknown;
        };
      }
  >;
  created_at: string;
}

// ─── User Actions ─────────────────────────────────────────────────────────────

/**
 * What the user can send — maps to POST /api/v1/projects/:id/messages
 * Backend unified endpoint handles both actions.
 */
export type UserAction =
  | { action: "send_message";    content: string }
  | { action: "provide_env_vars"; vars: Record<string, string> };

// ─── API response types ───────────────────────────────────────────────────────

export interface MessagesResponse {
  messages:     Message[];
  total:        number;
  offset:       number;
  has_more:     boolean;
  active_build: { id: string; status: string } | null;
}

export interface SendMessageResponse {
  user_message_id: string;
  thread_id:       string;
  status:          string;
  stream_url:      string;
}