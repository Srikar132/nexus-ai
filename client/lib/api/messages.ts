/**
 * lib/api/messages.ts
 * 
 * Messages & Workflow API endpoints
 */

import { apiFetch } from "./fetch";
import { API_ENDPOINTS } from "./config";
import type { Message, UserAction } from "@/types/workflow";

// Response types
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

export const messagesAPI = {
  /**
   * Get message history
   * GET /api/v1/projects/:id/messages
   */
  list: async (projectId: string, offset = 0, limit = 50) => {
    return apiFetch<MessagesResponse>(API_ENDPOINTS.messages.list(projectId), {
      method: "GET",
      params: {
        offset: String(offset),
        limit: String(limit),
      },
    });
  },

  /**
   * Send a user action to the workflow
   * POST /api/v1/projects/:id/messages
   */
  sendAction: async (projectId: string, userAction: UserAction) => {
    // Build request body matching backend SendMessageRequest
    const body: Record<string, unknown> = { action: userAction.action };

    if ("content" in userAction) body.content = userAction.content;
    if ("edited_plan" in userAction) body.edited_plan = userAction.edited_plan;
    if ("vars" in userAction) body.vars = userAction.vars;

    // approve_plan needs dummy content for backend validation
    if (userAction.action === "approve_plan") body.content = "";

    return apiFetch<SendMessageResponse>(API_ENDPOINTS.messages.create(projectId), {
      method: "POST",
      body,
    });
  },

  /**
   * Confirm deployment with env vars
   * POST /api/v1/projects/:id/messages/deploy-confirm
   */
  deployConfirm: async (projectId: string, plaintext_vars: Record<string, string>) => {
    return apiFetch<void>(API_ENDPOINTS.messages.deployConfirm(projectId), {
      method: "POST",
      body: { plaintext_vars },
    });
  },

  /**
   * Get SSE stream URL (for EventSource)
   */
  getStreamURL: (projectId: string) => {
    return API_ENDPOINTS.messages.stream(projectId);
  },
};
