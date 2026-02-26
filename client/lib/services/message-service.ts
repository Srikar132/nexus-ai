/**
 * lib/services/message-service.ts
 *
 * All message + workflow CRUD for client-side use.
 * Uses clientFetch (NOT fetchAPI which is "use server").
 * Cookies + auth token are handled automatically by clientFetch.
 */

import { clientFetch } from "@/lib/client-fetch";
import type { Message, UserAction } from "@/types/workflow";

const BASE = (projectId: string) => `/api/v1/projects/${projectId}`;

// ─── Response shapes ─────────────────────────────────────────────────────────

export interface MessagesResponse {
  messages: Message[];
  total: number;
  offset: number;
  has_more: boolean;
  active_build: { id: string; status: string } | null;
}

export interface SendMessageResponse {
  user_message_id: string;
  thread_id: string;
  status: string;
  stream_url: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

const messageService = {
  /**
   * Load paginated message history for a project.
   * Used by TanStack Query — result is cached + paginated.
   */
  getMessages: async (
    projectId: string,
    offset = 0,
    limit = 50
  ): Promise<MessagesResponse> => {
    const res = await clientFetch<MessagesResponse>(
      `${BASE(projectId)}/messages`,
      { params: { offset: String(offset), limit: String(limit) } }
    );
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  /**
   * Send a user action to the backend.
   * This is the ONLY way the UI talks to LangGraph.
   *
   * Maps UserAction union to the POST /messages body.
   * Backend's SendMessageRequest expects: { content, action, edited_plan? }
   */
  sendAction: async (
    projectId: string,
    userAction: UserAction
  ): Promise<SendMessageResponse> => {
    // Build the exact shape the backend SendMessageRequest expects
    const body: Record<string, unknown> = { action: userAction.action };

    if ("content" in userAction) body["content"] = userAction.content;
    if ("editedPlan" in userAction) body["editedPlan"] = userAction.editedPlan;
    if ("vars" in userAction) body["vars"] = userAction.vars;

    // approve_plan needs a dummy content so backend validation passes
    if (userAction.action === "approve_plan") body["content"] = "";

    const res = await clientFetch<SendMessageResponse>(
      `${BASE(projectId)}/messages`,
      { method: "POST", body }
    );
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  /**
   * Submit env vars for deployment confirmation.
   * POST /messages/deploy-confirm
   */
  deployConfirm: async (
    projectId: string,
    plaintext_vars: Record<string, string>
  ): Promise<void> => {
    const res = await clientFetch(
      `${BASE(projectId)}/messages/deploy-confirm`,
      { method: "POST", body: { plaintext_vars } }
    );
    if (res.error) throw new Error(res.error);
  },
};

export default messageService;
