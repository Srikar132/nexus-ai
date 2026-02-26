/**
 * store/workflow-store.ts
 *
 * Zustand store — owns ONLY the live SSE-driven DISPLAY state.
 * NOT for message history — that's TanStack Query (single source of truth).
 *
 * What lives here:
 *  - stage          → current workflow stage (driven by SSE stage_change events)
 *  - active_plan     → plan artifact received from conductor
 *  - streaming_text  → text chunks being streamed right now (ephemeral display)
 *  - active_role     → which agent is currently active
 *  - error          → any workflow error
 *
 * What does NOT live here:
 *  - messages       → TanStack Query owns this (refetched from DB after SSE done)
 */

import { create } from "zustand";
import type { WorkflowStage, Plan, Message, SSEEvent } from "@/types/workflow";

// ─── Shape ───────────────────────────────────────────────────────────────────

interface WorkflowStore {
  // Live state
  stage: WorkflowStage;
  active_plan: Plan | null;
  streaming_text: string;        // Ephemeral — clears on agent_done
  active_role: string | null;
  is_streaming: boolean;
  error: string | null;

  // Actions — called by useWorkflow hook only, not directly by UI
  handleSSEEvent: (event: SSEEvent) => void;
  reset: () => void;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL: Omit<WorkflowStore, "handleSSEEvent" | "reset"> = {
  stage: "idle",
  active_plan: null,
  streaming_text: "",
  active_role: null,
  is_streaming: false,
  error: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  ...INITIAL,

  // ── The ONLY place SSE events mutate state ───────────────────────────────
  handleSSEEvent: (event: SSEEvent) => {
    console.log("[WorkflowStore] Handling SSE event:", event);
    
    switch (event.type) {

      case "stage_change":
        console.log("[WorkflowStore] Stage change:", event.stage);
        set({ 
          stage: event.stage, 
          error: null,
          streaming_text: "",      // Clear any orphaned streaming text
          is_streaming: false,
        });
        break;

      case "agent_start":
        console.log("[WorkflowStore] Agent start:", event.role);
        set({ active_role: event.role });
        break;

      case "agent_done":
        console.log("[WorkflowStore] Agent done:", event.role);
        // Agent finished — clear streaming display
        set({ 
          streaming_text: "",
          is_streaming: false,
          active_role: null,
        });
        break;

      case "text_chunk":
        const newText = get().streaming_text + event.chunk;
        console.log("[WorkflowStore] Text chunk received. New length:", newText.length);
        set((s) => ({
          is_streaming: true,
          streaming_text: s.streaming_text + event.chunk,
          active_role: event.role,
        }));
        break;

      case "artifact": {
        console.log("[WorkflowStore] Artifact received:", event.artifact_type);
        const updates: Partial<WorkflowStore> = {};

        // If it's a plan artifact → store it (but don't change stage yet - let stage_change handle it)
        if (event.artifact_type === "plan") {
          updates.active_plan = event.content as Plan;
        }

        // Don't clear streaming state here - let agent_done or stage_change handle it
        set(updates as any);
        break;
      }

      case "done":
        console.log("[WorkflowStore] Stream done");
        // Stream finished — backend has saved all messages to DB
        // TanStack Query will refetch and get the persisted versions
        set({ 
          streaming_text: "",
          is_streaming: false,
        });
        break;

      case "error":
        console.log("[WorkflowStore] Error:", event.message);
        set({ stage: "error", error: event.message, is_streaming: false });
        break;
    }
  },

  reset: () => set({ ...INITIAL }),
}));
