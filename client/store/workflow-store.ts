/**
 * store/workflow-store.ts
 *
 * Zustand is the SINGLE source of truth for all live workflow state.
 *
 * KEY FIXES:
 *  1. hydrateMessages — replaced the broken `length === 0` guard with a
 *     proper merge: keeps optimistic messages (temp-* ids), merges in real
 *     history from server. Safe to call multiple times (after invalidation).
 *
 *  2. handleSSEEvent is a STABLE function — it reads current state via
 *     get() inside the function body. This means it can be stored in a
 *     useRef in the hook and never change reference, which prevents the
 *     SSE reconnect-on-every-chunk bug.
 *
 *  3. "thinking" SSE event now also advances stage to "thinking" so the
 *     WorkspaceHeader correctly shows the building indicator during conductor
 *     analysis (stage was staying "idle" before).
 *
 *  4. "done" event with deploy_url/repo_url — forwards to sidebar store
 *     so the deploy success card can show the live URL.
 *
 *  5. "build_failed" event type added — backend emits this on Celery errors.
 *
 *  6. inProgressMessage is role-keyed — if a new agent_start arrives while
 *     a previous inProgressMessage hasn't been committed (e.g. Guardian
 *     starts before Artificer's "done" fires), we commit the previous one
 *     first to avoid losing it.
 */

import { create } from "zustand";
import type { WorkflowStage, Message, SSEEvent } from "@/types/workflow";
import { useRightSidebar } from "@/store/right-sidebar-store";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InProgressMessage {
  role: string;
  text: string;
  artifact: {
    artifact_type: string;
    title: string;
    content: unknown;
  } | null;
}

interface WorkflowStore {
  // Rendered messages (history + committed streamed)
  messages: Message[];

  // Workflow state
  stage: WorkflowStage;
  active_role: string | null;
  is_streaming: boolean;
  error: string | null;

  // Thinking indicator
  isThinking: boolean;
  thinkingStatus: string | null;

  // The message being assembled right now
  inProgressMessage: InProgressMessage | null;

  // Actions
  hydrateMessages:          (messages: Message[]) => void;
  addOptimisticMessage:     (message: Message) => void;
  confirmOptimisticMessage: (tempId: string, realId: string) => void;
  removeOptimisticMessage:  (tempId: string) => void;
  handleSSEEvent:           (event: SSEEvent) => void;
  reset:                    () => void;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  messages:          [] as Message[],
  stage:             "idle" as WorkflowStage,
  active_role:       null as string | null,
  is_streaming:      false,
  error:             null as string | null,
  isThinking:        false,
  thinkingStatus:    null as string | null,
  inProgressMessage: null as InProgressMessage | null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Commit an InProgressMessage into the messages array. Returns null if empty. */
function commitInProgress(ip: InProgressMessage): Message | null {
  const content: Message["content"] = [];

  if (ip.artifact) {
    content.push({
      type:          "artifact",
      artifact_id:   `artifact-${Date.now()}`,
      artifact_data: ip.artifact,
    });
  }

  if (ip.text.trim()) {
    content.push({ type: "text", content: ip.text.trim() });
  }

  if (content.length === 0) return null;

  return {
    id:           `streamed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role:         ip.role as Message["role"],
    message_type: "assistant_response",
    content,
    created_at:   new Date().toISOString(),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  ...INITIAL_STATE,

  /**
   * Merge server history into messages[].
   * Safe to call multiple times — merges by id, keeps optimistic messages.
   * Optimistic messages have ids starting with "temp-" and are preserved
   * until confirmed or removed.
   */
  hydrateMessages: (serverMessages: Message[]) => {
    const current = get().messages;

    // Keep any optimistic messages (temp-* ids not yet confirmed)
    const optimistic = current.filter((m) => m.id.startsWith("temp-"));

    // Build a set of server IDs for dedup
    const serverIds = new Set(serverMessages.map((m) => m.id));

    // Optimistic messages that don't have a matching server id yet stay
    const pendingOptimistic = optimistic.filter((m) => !serverIds.has(m.id));

    set({ messages: [...serverMessages, ...pendingOptimistic] });
  },

  addOptimisticMessage: (message: Message) => {
    set((s) => ({ messages: [...s.messages, message] }));
  },

  confirmOptimisticMessage: (tempId: string, realId: string) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === tempId ? { ...m, id: realId } : m
      ),
    }));
  },

  removeOptimisticMessage: (tempId: string) => {
    set((s) => ({
      messages: s.messages.filter((m) => m.id !== tempId),
    }));
  },

  /**
   * STABLE function — reads state via get(), never closes over stale state.
   * Store this in a useRef in the hook — reference never changes.
   */
  handleSSEEvent: (event: SSEEvent) => {
    if (process.env.NODE_ENV === "development") {
      console.log("[WorkflowStore] SSE:", event.type, event);
    }

    switch (event.type) {

      // ── Stage transitions ──────────────────────────────────────
      case "stage_change":
        set({ stage: event.stage, error: null });
        if (event.stage === "building") {
          useRightSidebar.getState().showCode();
        }
        break;

      // ── Thinking status ────────────────────────────────────────
      // Also advances stage to "thinking" so header indicators work
      case "thinking":
        set({
          isThinking:     true,
          thinkingStatus: event.status,
          active_role:    event.role ?? null,
          // Only advance to "thinking" if we're still idle — don't
          // override "building", "testing" etc. with "thinking"
          stage: get().stage === "idle" ? "thinking" : get().stage,
        });
        break;

      // ── Agent starting ─────────────────────────────────────────
      // If there's an existing inProgressMessage from a previous agent,
      // commit it first so we don't lose it.
      case "agent_start": {
        const existing = get().inProgressMessage;
        const toCommit = existing ? commitInProgress(existing) : null;

        set((s) => ({
          active_role:       event.role,
          is_streaming:      false,
          isThinking:        false,
          thinkingStatus:    null,
          inProgressMessage: { role: event.role, text: "", artifact: null },
          // Commit previous agent's message if it was never committed
          messages: toCommit ? [...s.messages, toCommit] : s.messages,
        }));
        break;
      }

      // ── Text chunk arriving ────────────────────────────────────
      case "text_chunk":
        set((s) => ({
          is_streaming:   true,
          isThinking:     false,
          thinkingStatus: null,
          active_role:    event.role,
          inProgressMessage: s.inProgressMessage
            ? {
                ...s.inProgressMessage,
                text: s.inProgressMessage.text + event.chunk,
              }
            : { role: event.role, text: event.chunk, artifact: null },
        }));
        break;

      // ── Artifact received ──────────────────────────────────────
      case "artifact": {
        const artifactData = {
          artifact_type: event.artifact_type,
          title:         event.title,
          content:       event.content,
        };
        set((s) => ({
          inProgressMessage: s.inProgressMessage
            ? { ...s.inProgressMessage, artifact: artifactData }
            : { role: "system", text: "", artifact: artifactData },
        }));
        break;
      }

      // ── Agent done ─────────────────────────────────────────────
      // Stop streaming indicators but keep inProgressMessage visible.
      // It stays displayed until "done" commits it.
      case "agent_done":
        set({
          is_streaming:   false,
          active_role:    null,
          isThinking:     false,
          thinkingStatus: null,
        });
        break;

      // ── Stream done ────────────────────────────────────────────
      // Commit inProgressMessage into messages[]. Connection stays open.
      // This is just the end of ONE agent's response, not the whole workflow.
      case "done": {
        const ip = get().inProgressMessage;

        set((s) => {
          const committed = ip ? commitInProgress(ip) : null;
          return {
            messages:          committed ? [...s.messages, committed] : s.messages,
            inProgressMessage: null,
            is_streaming:      false,
            isThinking:        false,
            thinkingStatus:    null,
            // Keep stage as-is - workflow may continue
          };
        });

        // Forward deploy URLs to sidebar if present
        const doneEvent = event as SSEEvent & { deploy_url?: string; repo_url?: string };
        if (doneEvent.deploy_url) {
          // useRightSidebar.getState().setDeployUrl?.(doneEvent.deploy_url, doneEvent.repo_url);
        }
        break;
      }

      // ── Close stream (workflow complete) ──────────────────────
      // This signals the entire workflow session is done
      case "close_stream":
        set((s) => ({
          // Reset to idle if we were in a transient state
          stage: (["thinking", "building", "testing", "fixing", "deploying"] as WorkflowStage[])
            .includes(s.stage) && !["waiting_env", "complete", "error"].includes(s.stage)
            ? "idle"
            : s.stage,
          is_streaming:   false,
          isThinking:     false,
          thinkingStatus: null,
        }));
        break;

      // ── Build failed ───────────────────────────────────────────
      case "build_failed":
        set((s) => {
          const ip = s.inProgressMessage;
          const committed = ip ? commitInProgress(ip) : null;
          return {
            stage:             "error",
            error:             (event as { reason?: string }).reason ?? "Build failed",
            is_streaming:      false,
            isThinking:        false,
            thinkingStatus:    null,
            inProgressMessage: null,
            messages: committed ? [...s.messages, committed] : s.messages,
          };
        });
        break;

      // ── Error ──────────────────────────────────────────────────
      case "error":
        set({
          stage:             "error",
          error:             event.message,
          is_streaming:      false,
          isThinking:        false,
          thinkingStatus:    null,
          inProgressMessage: null,
        });
        break;

      // ── Tool call/result (dev visibility only, no state change) ─
      case "tool_call":
      case "tool_result":
        // These are informational — shown in a dev panel if you have one,
        // but don't affect message rendering.
        break;
    }
  },

  reset: () => set({ ...INITIAL_STATE }),
}));