/**
 * Workflow types — mirrors backend WorkflowStage exactly.
 * The backend sends these via SSE. UI reacts to them.
 */

export type WorkflowStage =
  | "idle"           // No workflow running yet
  | "planning"       // Conductor is generating plan (streaming)
  | "plan_review"    // Plan ready — waiting for user to approve/edit
  | "building"       // Artificer is writing code
  | "testing"        // Guardian is running security checks
  | "fixing"         // Artificer is fixing issues found by Guardian
  | "deploying"      // Deployer is running
  | "waiting_env"    // Deployer waiting for user env vars
  | "complete"       // Done
  | "error";         // Something failed

/**
 * Every SSE event from the backend has this shape.
 * Backend publishes these via Redis → SSE stream.
 */
export type SSEEvent =
  | { type: "stage_change"; stage: WorkflowStage }
  | { type: "thinking"; status: string; role?: string }
  | { type: "text_chunk"; chunk: string; role: string }
  | { type: "artifact"; artifact_type: string; title: string; content: unknown }
  | { type: "tool_call"; role: string; tool: string; input: string }
  | { type: "tool_result"; role: string; tool: string; result: string }
  | { type: "agent_start"; role: string }
  | { type: "agent_done"; role: string }
  | { type: "file_created"; path: string; content: string; lines: number; size: number }
  | { type: "file_deleted"; path: string }
  | { type: "error"; message: string }
  | { type: "done" };

/**
 * A plan artifact — what conductor produces during "planning" stage.
 */
export interface Plan {
  overview: string;
  tech_stack: {
    language: string;
    framework: string;
    database: string;
  };
  architecture: {
    diagram: string;
    content: string;
  };
  database_schemas: Record<string, Record<string, string>>;
  endpoints: Array<{
    path: string;
    method: string;
    description: string;
  }>;
}

/**
 * A message in the chat — stored in DB, loaded on mount.
 * Role matches backend: user | conductor | artificer | guardian | deployer | system
 */
export interface Message {
  id: string;
  role: "user" | "conductor" | "artificer" | "guardian" | "deployer" | "system";
  message_type: string;
  content: Array<
    | { type: "text"; content: string }
    | { type: "artifact"; artifact_id: string; artifact_data?: { artifact_type: string; title: string; content: unknown } }
  >;
  created_at: string;
}

/**
 * What useWorkflow hook exposes to the UI.
 */
export interface WorkflowState {
  stage: WorkflowStage;
  messages: Message[];
  active_plan: Plan | null;
  is_streaming: boolean;
  streaming_text: string;    // Text currently being streamed
  active_role: string | null; // Which agent is active right now
  error: string | null;
}

/**
 * What the user can send — explicit actions, never inferred from text.
 */
export type UserAction =
  | { action: "direct_build"; content: string }    // Build now button
  | { action: "request_plan"; content: string }    // Plan button
  | { action: "approve_plan" }                     // Approve button on plan card
  | { action: "edit_plan"; edited_plan: Plan }      // Save edits on plan card
  | { action: "send_message"; content: string }    // Regular chat
  | { action: "provide_env_vars"; vars: Record<string, string> }; // Deploy env vars
