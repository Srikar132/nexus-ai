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
    isThinking,
    thinkingStatus,
    hydrateMessages,
    addOptimisticMessage,
    confirmOptimisticMessage,
    removeOptimisticMessage,
    handleSSEEvent,
    setThinking,
    reset,
  } = useWorkflowStore();

  // ── Initial history load ─────────────────────────────────────────────────
  // TanStack Query fetches once, hydrates Zustand, then steps back.
  const { data: historyQueryData, isLoading: isLoadingHistory, isError: isHistoryError } = useQuery({
    queryKey: workflowKeys.messages(projectId),
    queryFn: async () => {
      const response = await messagesAPI.list(projectId, 0, 50);
      if (response.error) throw new Error(response.error);
      return response.data!;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,    // 5 min — allows refetch on page reload but not on every re-render
    refetchOnWindowFocus: false,
    refetchOnMount: "always",     // Always refetch on mount — ensures DB messages show after refresh
  });

  // Hydrate Zustand from query data — runs only when the fetched data actually changes.
  // This is intentionally in a useEffect (not select) to avoid side-effects during render.
  const hydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!historyQueryData?.messages) return;
    // Build a cheap fingerprint so we don't re-hydrate with identical data
    const fingerprint = historyQueryData.messages.map((m: Message) => m.id).join(",");
    if (fingerprint === hydratedRef.current) return;
    hydratedRef.current = fingerprint;
    hydrateMessages(historyQueryData.messages);
  }, [historyQueryData, hydrateMessages]);

  // ── Restore stage from active_build on page load mid-workflow ────────────
  useEffect(() => {
    const activeBuild = (historyQueryData as any)?.active_build;
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
  }, [historyQueryData, stage]);

  // ── SSE connection ────────────────────────────────────────────────────────
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSSEEventWithSideEffects = useCallback(
    (sseEvent: SSEEvent) => {
      handleSSEEvent(sseEvent);

      // On "done": silently invalidate TanStack cache in background.
      // This is for correctness if user navigates away and comes back —
      // the cache will be fresh. It does NOT affect current UI rendering.
      if (sseEvent.type === "done") {
        queryClient.invalidateQueries({
          queryKey: workflowKeys.messages(projectId),
        });
      }
    },
    [handleSSEEvent, queryClient, projectId]
  );

  const connectSSE = useCallback(() => {
    if (!projectId || projectId === "undefined") return;

    eventSourceRef.current?.close();
    eventSourceRef.current = null;

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const url = `${API_BASE}/api/v1/projects/${projectId}/messages/stream`;
    console.log("[SSE] Connecting:", url);

    const es = new EventSource(url, { withCredentials: true });

    es.onopen = () => console.log("[SSE] Opened");

    es.onmessage = (event) => {
      try {
        const sseEvent: SSEEvent = JSON.parse(event.data);
        handleSSEEventWithSideEffects(sseEvent);
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
  }, [projectId, handleSSEEventWithSideEffects]);

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
      // Show thinking indicator immediately — before server even responds
      setThinking("Analyzing your request...");

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
      setThinking(null);
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
    isThinking,
    thinkingStatus,
    error,

    // Loading flags
    isLoadingHistory,
    isHistoryError,
    isSending: sendMutation.isPending,

    // Actions
    sendAction: (action: UserAction) => sendMutation.mutate(action),
  };
}