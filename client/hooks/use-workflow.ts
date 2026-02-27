"use client";

/**
 * hooks/use-workflow.ts
 *
 * REDESIGN:
 *  - TanStack Query = initial history load ONLY → feeds into Zustand via hydrateMessages()
 *  - SSE = live state, builds messages[] in Zustand directly
 *  - No refetch after SSE "done" — Zustand commits the message locally
 *  - Background invalidation only (for cache consistency if user navigates away and back)
 *
 * Data flow:
 *  mount → fetchHistory → hydrateMessages(zustand)
 *  user sends → addOptimisticMessage → server confirms → confirmOptimisticMessage
 *  SSE chunks → handleSSEEvent → inProgressMessage accumulates
 *  SSE done   → inProgressMessage committed to messages[] (no network)
 *  background → invalidateQueries (silent, doesn't affect UI)
 */

import { useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkflowStore } from "@/store/workflow-store";
import { messagesAPI } from "@/lib/api";
import type { UserAction, Message, SSEEvent } from "@/types/workflow";

export const workflowKeys = {
  messages: (projectId: string) => ["messages", projectId] as const,
};

export function useWorkflow(projectId: string) {
  const queryClient = useQueryClient();

  const {
    messages,
    stage,
    active_plan,
    active_role,
    is_streaming,
    error,
    inProgressMessage,
    hydrateMessages,
    addOptimisticMessage,
    confirmOptimisticMessage,
    removeOptimisticMessage,
    handleSSEEvent,
    reset,
  } = useWorkflowStore();

  // ── Initial history load ─────────────────────────────────────────────────
  // TanStack Query fetches once, hydrates Zustand, then steps back.
  // staleTime: Infinity means it won't auto-refetch — Zustand owns live state.
  const { isLoading: isLoadingHistory, isError: isHistoryError } = useQuery({
    queryKey: workflowKeys.messages(projectId),
    queryFn: async () => {
      const response = await messagesAPI.list(projectId, 0, 50);
      if (response.error) throw new Error(response.error);
      return response.data!;
    },
    enabled: !!projectId,
    staleTime: Infinity,          // Never auto-refetch — SSE keeps us live
    refetchOnWindowFocus: false,
    refetchOnMount: false,        // Only fetch fresh on first mount
    // Feed data into Zustand as soon as it arrives
    select: (data) => {
      hydrateMessages(data.messages ?? []);
      return data;
    },
  });

  // ── Restore stage from active_build on page load mid-workflow ────────────
  const historyData = queryClient.getQueryData<{ active_build?: { status: string } }>(
    workflowKeys.messages(projectId)
  );
  useEffect(() => {
    const activeBuild = historyData?.active_build;
    if (!activeBuild || stage !== "idle") return;
    const statusToStage: Record<string, string> = {
      running: "building",
      planning: "planning",
      testing: "testing",
      deploying: "deploying",
      waiting_env: "waiting_env",
    };
    const restored = statusToStage[activeBuild.status];
    if (restored) useWorkflowStore.setState({ stage: restored as any });
  }, [historyData?.active_build, stage]);

  // ── SSE connection ────────────────────────────────────────────────────────
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Store handler in ref to avoid reconnecting SSE when handler changes
  const handleSSEEventRef = useRef<(sseEvent: SSEEvent) => void>(() => { });

  useEffect(() => {
    handleSSEEventRef.current = (sseEvent: SSEEvent) => {
      handleSSEEvent(sseEvent);

      // On "done": silently invalidate TanStack cache in background.
      // This is for correctness if user navigates away and comes back —
      // the cache will be fresh. It does NOT affect current UI rendering.
      if (sseEvent.type === "done") {
        queryClient.invalidateQueries({
          queryKey: workflowKeys.messages(projectId),
        });
      }
    };
  }, [handleSSEEvent, queryClient, projectId]);

  const connectSSE = useCallback(() => {
    if (!projectId || projectId === "undefined") return;

    eventSourceRef.current?.close();
    eventSourceRef.current = null;

    // Use Next.js rewrite proxy by default for same-origin SSE (avoids CORS issues)
    // Falls back to direct FastAPI connection if needed
    const USE_PROXY = true; // Set to false if you experience SSE buffering issues

    let url: string;
    if (USE_PROXY) {
      // Same-origin via Next.js rewrite - no CORS issues, cookies sent automatically
      url = `/api/v1/projects/${projectId}/messages/stream`;
      console.log("[SSE] Connecting via Next.js proxy:", url);
    } else {
      // Direct to FastAPI - requires CORS configuration
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      url = `${API_BASE}/api/v1/projects/${projectId}/messages/stream`;
      console.log("[SSE] Connecting directly to FastAPI:", url);
    }

    const es = new EventSource(url, USE_PROXY ? {} : { withCredentials: true });

    es.onopen = () => console.log("[SSE] Opened");

    es.onmessage = (event) => {
      try {
        const sseEvent: SSEEvent = JSON.parse(event.data);
        handleSSEEventRef.current(sseEvent);
      } catch (err) {
        console.error("[SSE] Parse error:", err);
      }
    };

    es.onerror = () => {
      es.close();
      const s = useWorkflowStore.getState().stage;
      if (s !== "idle" && s !== "complete" && s !== "error") {
        retryRef.current = setTimeout(connectSSE, 3000);
      }
    };

    eventSourceRef.current = es;
  }, [projectId]);

  useEffect(() => {
    connectSSE();
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connectSSE]);

  useEffect(() => { reset(); }, [projectId, reset]);

  // ── Send action ───────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async (action: UserAction) => {
      const response = await messagesAPI.sendAction(projectId, action);
      if (response.error) throw new Error(response.error);
      return response.data!;
    },

    onMutate: async (action) => {
      if ("content" in action && action.content) {
        const tempId = `temp-${Date.now()}`;
        const optimistic: Message = {
          id: tempId,
          role: "user",
          message_type: "user_prompt",
          content: [{ type: "text", content: action.content }],
          created_at: new Date().toISOString(),
        };
        addOptimisticMessage(optimistic);
        return { tempId };
      }
    },

    onSuccess: (response, _action, context) => {
      if (context?.tempId) {
        confirmOptimisticMessage(context.tempId, response.user_message_id);
      }
    },

    onError: (err, _action, context) => {
      if (context?.tempId) {
        removeOptimisticMessage(context.tempId);
      }
      useWorkflowStore.setState({
        stage: "error",
        error: err instanceof Error ? err.message : "Failed to send",
      });
    },
  });

  // ── Derive streaming text from inProgressMessage ──────────────────────────
  const streaming_text = inProgressMessage?.text ?? "";

  return {
    // Data — all from Zustand, never from TanStack Query directly
    messages,
    stage,
    active_plan,
    streaming_text,
    active_role,
    is_streaming,
    inProgressMessage,
    error,

    // Loading flags
    isLoadingHistory,
    isHistoryError,
    isSending: sendMutation.isPending,

    // Actions
    sendAction: (action: UserAction) => sendMutation.mutate(action),
  };
}