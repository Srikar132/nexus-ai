/**
 * store/workflow-store.ts
 *
 * REDESIGN: Zustand is the SINGLE source of truth for ALL messages.
 *
 * Flow:
 *  1. Page load → TanStack Query fetches history → calls hydrateMessages()
 *  2. SSE events mutate Zustand directly — no backend round-trips ever
 *  3. "done" event → commits the inProgressMessage into messages[] locally
 *  4. TanStack Query invalidates silently in background (cache only, never blocks UI)
 *
 * Why this is better:
 *  - Zero refetch latency — message appears the instant SSE "done" fires
 *  - No flash of empty content between streaming end and DB refetch
 *  - Message order is always correct (optimistic user msg → streaming → committed)
 *  - SSE is the source of truth for live state; DB is just persistence
 */

import { create } from "zustand";
import type { WorkflowStage, Plan, Message, SSEEvent } from "@/types/workflow";

// ─── Types ────────────────────────────────────────────────────────────────────

/** The message currently being assembled from SSE chunks — not yet in messages[] */
interface InProgressMessage {
  role: string;
  text: string;
  artifact: {
    artifact_type: string;
    title: string;
    content: unknown;
  } | null;
}

interface WorkflowStore {
  // ── Rendered messages (history + committed streamed) ──
  messages: Message[];

  // ── Workflow stage ──
  stage: WorkflowStage;
  active_plan: Plan | null;
  active_role: string | null;
  is_streaming: boolean;
  error: string | null;

  // ── The message being built right now from SSE chunks ──
  // Stays null between turns. Shown as live preview. Committed on "done".
  inProgressMessage: InProgressMessage | null;

  // ── Actions ──
  hydrateMessages: (messages: Message[]) => void;
  addOptimisticMessage: (message: Message) => void;
  confirmOptimisticMessage: (tempId: string, realId: string) => void;
  removeOptimisticMessage: (tempId: string) => void;
  handleSSEEvent: (event: SSEEvent) => void;
  reset: () => void;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL: Omit<
  WorkflowStore,
  | "hydrateMessages"
  | "addOptimisticMessage"
  | "confirmOptimisticMessage"
  | "removeOptimisticMessage"
  | "handleSSEEvent"
  | "reset"
> = {
  messages: [],
  stage: "idle",
  active_plan: null,
  active_role: null,
  is_streaming: false,
  error: null,
  inProgressMessage: null,
};

// ─── Helper: commit inProgressMessage → Message ───────────────────────────────

function commitInProgress(ip: InProgressMessage): Message | null {
  const content: Message["content"] = [];

  // Artifact goes first (like a plan card above the text)
  if (ip.artifact) {
    content.push({
      type: "artifact",
      artifact_id: `artifact-${Date.now()}`,
      artifact_data: ip.artifact,
    });
  }

  if (ip.text.trim()) {
    content.push({ type: "text", content: ip.text.trim() });
  }

  if (content.length === 0) return null;

  return {
    id: `streamed-${Date.now()}`,
    role: ip.role as Message["role"],
    message_type: "assistant_response",
    content,
    created_at: new Date().toISOString(),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  ...INITIAL,

  // ── Called once by TanStack Query after history loads ──────────────────────
  hydrateMessages: (messages: Message[]) => {
    // Guard: don't clobber messages if SSE already added some (e.g. slow network)
    if (get().messages.length === 0) {
      set({ messages });
    }
  },

  // ── Optimistic user message (shown before server confirms) ─────────────────
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

  // ── SSE event handler — the core of the live flow ─────────────────────────
  handleSSEEvent: (event: SSEEvent) => {
    console.log("[WorkflowStore] SSE:", event.type);

    switch (event.type) {

      // Stage transitions — just update stage label
      case "stage_change":
        set({ stage: event.stage, error: null });
        break;

      // Agent starting — open a fresh inProgressMessage slot for this agent
      case "agent_start":
        set({
          active_role: event.role,
          is_streaming: false,
          inProgressMessage: { role: event.role, text: "", artifact: null },
        });
        break;

      // Text arriving — append to inProgressMessage.text
      case "text_chunk":
        set((s) => ({
          is_streaming: true,
          active_role: event.role,
          inProgressMessage: s.inProgressMessage
            ? { ...s.inProgressMessage, text: s.inProgressMessage.text + event.chunk }
            : { role: event.role, text: event.chunk, artifact: null },
        }));
        break;

      // Artifact (e.g. plan) — attach to inProgressMessage
      case "artifact": {
        const artifactData = {
          artifact_type: event.artifact_type,
          title: event.title,
          content: event.content,
        };
        const planUpdate =
          event.artifact_type === "plan"
            ? { active_plan: event.content as Plan }
            : {};

        set((s) => ({
          ...planUpdate,
          inProgressMessage: s.inProgressMessage
            ? { ...s.inProgressMessage, artifact: artifactData }
            : { role: "conductor", text: "", artifact: artifactData },
        }));
        break;
      }

      // Agent done — stop the spinning cursor, but KEEP inProgressMessage visible.
      // The text stays on screen until "done" commits it — no flash.
      case "agent_done":
        set({ is_streaming: false, active_role: null });
        break;

      // Stream done — commit inProgressMessage into messages[] and clear it.
      // This is the ONLY write to messages[] from SSE. No network call needed.
      case "done":
        set((s) => {
          if (!s.inProgressMessage) return {};

          const committed = commitInProgress(s.inProgressMessage);
          return {
            messages: committed ? [...s.messages, committed] : s.messages,
            inProgressMessage: null,
            is_streaming: false,
          };
        });
        break;

      case "error":
        set({
          stage: "error",
          error: event.message,
          is_streaming: false,
          inProgressMessage: null,
        });
        break;
    }
  },

  reset: () => set({ ...INITIAL }),
}));