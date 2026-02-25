/**
 * store/workflow-store.ts
 *
 * Zustand store — owns ONLY the live SSE-driven state.
 * NOT for server data (messages history, project info) — that's TanStack Query.
 *
 * What lives here:
 *  - stage          → current workflow stage (driven by SSE stage_change events)
 *  - activePlan     → plan artifact received from conductor
 *  - streamingText  → text chunks being streamed right now
 *  - activeRole     → which agent is currently active
 *  - liveMessages   → optimistic + streamed messages (not persisted history)
 *  - error          → any workflow error
 */

import { create } from "zustand";
import type { WorkflowStage, Plan, Message, SSEEvent } from "@/types/workflow";

// ─── Shape ───────────────────────────────────────────────────────────────────

interface WorkflowStore {
  // Live state
  stage: WorkflowStage;
  activePlan: Plan | null;
  streamingText: string;
  activeRole: string | null;
  isStreaming: boolean;
  error: string | null;

  // Optimistic + streamed messages (merged with TanStack Query history in the hook)
  liveMessages: Message[];

  // Actions — called by useWorkflow hook only, not directly by UI
  handleSSEEvent: (event: SSEEvent) => void;
  addOptimisticMessage: (message: Message) => void;
  reset: () => void;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL: Omit<WorkflowStore, "handleSSEEvent" | "addOptimisticMessage" | "reset"> = {
  stage: "idle",
  activePlan: null,
  streamingText: "",
  activeRole: null,
  isStreaming: false,
  error: null,
  liveMessages: [],
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  ...INITIAL,

  // ── The ONLY place SSE events mutate state ───────────────────────────────
  handleSSEEvent: (event: SSEEvent) => {
    switch (event.type) {

      case "stage_change": {
        // Flush any in-flight stream before switching stage
        const { streamingText, activeRole } = get();
        if (streamingText) {
          const flushed: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            message_type: "text",
            content: [{ type: "text", content: streamingText }],
            created_at: new Date().toISOString(),
          };
          set((s) => ({
            stage: event.stage,
            streamingText: "",
            isStreaming: false,
            activeRole: null,
            liveMessages: [...s.liveMessages, flushed],
          }));
        } else {
          set({ stage: event.stage, error: null });
        }
        break;
      }

      case "agent_start":
        set({ activeRole: event.role });
        break;

      case "agent_done": {
        // Flush streamed text as a committed message
        const { streamingText } = get();
        if (streamingText) {
          const msg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            message_type: "text",
            content: [{ type: "text", content: streamingText }],
            created_at: new Date().toISOString(),
          };
          set((s) => ({
            liveMessages: [...s.liveMessages, msg],
            streamingText: "",
            isStreaming: false,
            activeRole: null,
          }));
        } else {
          set({ activeRole: null, isStreaming: false });
        }
        break;
      }

      case "text_chunk":
        set((s) => ({
          isStreaming: true,
          streamingText: s.streamingText + event.chunk,
          activeRole: event.role,
        }));
        break;

      case "artifact": {
        // Flush any streaming text first
        const { streamingText } = get();
        const extra: Message[] = [];
        if (streamingText) {
          extra.push({
            id: crypto.randomUUID(),
            role: "assistant",
            message_type: "text",
            content: [{ type: "text", content: streamingText }],
            created_at: new Date().toISOString(),
          });
        }

        // Create the artifact message
        const artifactMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          message_type: "artifact",
          content: [{
            type: "artifact",
            artifact_id: crypto.randomUUID(),
            artifact_data: {
              artifact_type: event.artifact_type,
              title: event.title,
              content: event.content,
            },
          }],
          created_at: new Date().toISOString(),
        };

        const updates: Partial<WorkflowStore> = {
          streamingText: "",
          isStreaming: false,
          liveMessages: [...get().liveMessages, ...extra, artifactMsg],
        };

        // If it's a plan artifact → store it + set stage to plan_review
        if (event.artifact_type === "plan") {
          updates.activePlan = event.content as Plan;
          updates.stage = "plan_review";
        }

        set(updates as any);
        break;
      }

      case "done":
        // Flush any remaining stream
        const { streamingText: remaining } = get();
        if (remaining) {
          const msg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            message_type: "text",
            content: [{ type: "text", content: remaining }],
            created_at: new Date().toISOString(),
          };
          set((s) => ({
            liveMessages: [...s.liveMessages, msg],
            streamingText: "",
            isStreaming: false,
          }));
        }
        break;

      case "error":
        set({ stage: "error", error: event.message, isStreaming: false });
        break;
    }
  },

  // ── Optimistic message (e.g. user sent a message, show it instantly) ─────
  addOptimisticMessage: (message: Message) => {
    set((s) => ({ liveMessages: [...s.liveMessages, message] }));
  },

  reset: () => set({ ...INITIAL }),
}));
