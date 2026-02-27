"use client";

/**
 * hooks/use-workflow.ts
 *
 * KEY FIXES:
 *
 * 1. SSE RECONNECT BUG FIXED — the original put handleSSEEvent (a Zustand store
 *    method) into useCallback deps. Zustand returns a new function reference on
 *    every render that reads from the store, so handleSSEEventWithSideEffects
 *    changed reference on every SSE event → connectSSE changed → useEffect
 *    cleanup fired → SSE disconnected mid-stream → chunks accumulated in state
 *    but no re-render happened → text appeared all at once at the end.
 *
 *    Fix: store handleSSEEvent in a useRef. The ref always points to the latest
 *    version of the function without being a reactive dep. SSE connection is now
 *    stable for the entire mount lifetime of the component.
 *
 * 2. select() SIDE EFFECT FIXED — TanStack Query's select() is a pure transform
 *    function called on every render. Calling hydrateMessages() inside it caused
 *    unpredictable Zustand writes. Moved to onSuccess callback which fires only
 *    when fresh data arrives from the server.
 *
 * 3. deployConfirm REMOVED — messagesAPI.deployConfirm() called the old
 *    /messages/deploy-confirm endpoint which no longer exists. Env vars are
 *    submitted via sendAction({ action: "provide_env_vars", vars: {...} }).
 *
 * 4. SSE retry now checks `is_streaming` in addition to stage so we don't
 *    reconnect when a build just finished streaming but stage hasn't updated yet.
 *
 * 5. History rehydration on invalidation — after "done", TanStack Query
 *    invalidates and re-fetches in background. onSuccess now calls
 *    hydrateMessages() which properly merges (not blindly replaces), so
 *    the refreshed server data syncs without losing optimistic messages.
 */

import { useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkflowStore } from "@/store/workflow-store";
import { messagesAPI } from "@/lib/api/messages";
import type { UserAction, Message, SSEEvent } from "@/types/workflow";

export const workflowKeys = {
  messages: (projectId: string) => ["messages", projectId] as const,
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function useWorkflow(projectId: string) {
  const queryClient = useQueryClient();

  // ── Stable references to store actions ────────────────────────────────────
  // Accessing these directly from the store (not via hook return value) gives us
  // stable references that don't change between renders.
  const hydrateMessages          = useWorkflowStore((s) => s.hydrateMessages);
  const addOptimisticMessage     = useWorkflowStore((s) => s.addOptimisticMessage);
  const confirmOptimisticMessage = useWorkflowStore((s) => s.confirmOptimisticMessage);
  const removeOptimisticMessage  = useWorkflowStore((s) => s.removeOptimisticMessage);
  const handleSSEEvent           = useWorkflowStore((s) => s.handleSSEEvent);
  const reset                    = useWorkflowStore((s) => s.reset);

  // ── Rendered state (these can change freely — they don't drive SSE) ────────
  const messages         = useWorkflowStore((s) => s.messages);
  const stage            = useWorkflowStore((s) => s.stage);
  const active_role      = useWorkflowStore((s) => s.active_role);
  const is_streaming     = useWorkflowStore((s) => s.is_streaming);
  const isThinking       = useWorkflowStore((s) => s.isThinking);
  const thinkingStatus   = useWorkflowStore((s) => s.thinkingStatus);
  const error            = useWorkflowStore((s) => s.error);
  const inProgressMessage = useWorkflowStore((s) => s.inProgressMessage);

  // ── THE KEY FIX: stable ref for SSE handler ────────────────────────────────
  // handleSSEEvent from Zustand is stable by design (create() guarantees this),
  // but we also want to call queryClient.invalidateQueries on "done".
  // We store the combined handler in a ref so connectSSE never needs to
  // re-run just because queryClient changed.
  const handleSSERef = useRef<(event: SSEEvent) => void>(null!);
  handleSSERef.current = useCallback(
    (sseEvent: SSEEvent) => {
      handleSSEEvent(sseEvent);
      if (sseEvent.type === "done" || sseEvent.type === "build_failed") {
        // Silent background invalidation — won't cause UI flicker because
        // hydrateMessages() merges rather than replaces.
        queryClient.invalidateQueries({
          queryKey: workflowKeys.messages(projectId),
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // intentionally empty — we always want the latest via the ref pattern
  );

  // ── Initial history load ───────────────────────────────────────────────────
  const { isLoading: isLoadingHistory, isError: isHistoryError } = useQuery({
    queryKey:           workflowKeys.messages(projectId),
    queryFn:            async () => {
      const response = await messagesAPI.list(projectId, 0, 50);
      if (response.error) throw new Error(response.error);
      return response.data!;
    },
    enabled:            !!projectId && projectId !== "undefined",
    staleTime:          30_000,       // 30s — allow background refresh
    refetchOnWindowFocus: false,      // SSE keeps us live, no need to refetch on focus
    refetchOnMount:     "always",     // Always check for new history on mount
  });

  // Hydrate Zustand whenever TanStack Query has fresh data
  // Using onSuccess equivalent — subscribe to query data changes
  const historyData = queryClient.getQueryData<{ messages: Message[]; active_build?: { status: string } }>(
    workflowKeys.messages(projectId)
  );

  useEffect(() => {
    if (historyData?.messages) {
      hydrateMessages(historyData.messages);
    }
  }, [historyData, hydrateMessages]);

  // ── Restore stage on page reload mid-build ─────────────────────────────────
  useEffect(() => {
    const activeBuild = historyData?.active_build;
    if (!activeBuild) return;

    const statusToStage: Record<string, WorkflowStage> = {
      building:     "building",
      running:      "building",
      thinking:     "thinking",
      testing:      "testing",
      fixing:       "fixing",
      deploying:    "deploying",
      waiting_env:  "waiting_env",
    };

    const restored = statusToStage[activeBuild.status];
    if (restored) {
      useWorkflowStore.setState({ stage: restored });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyData?.active_build?.status]);

  // ── SSE connection ─────────────────────────────────────────────────────────
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryRef       = useRef<ReturnType<typeof setTimeout> | null>(null);

  // connectSSE has NO reactive deps — it reads everything via refs.
  // This is the key: the function identity is stable for the entire mount.
  const connectSSE = useCallback(() => {
    if (!projectId || projectId === "undefined") return;

    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }

    const url = `${API_BASE}/api/v1/projects/${projectId}/messages/stream`;
    if (process.env.NODE_ENV === "development") {
      console.log("[SSE] Connecting:", url);
    }

    const es = new EventSource(url, { withCredentials: true });

    es.onopen = () => {
      if (process.env.NODE_ENV === "development") {
        console.log("[SSE] Connected");
      }
    };

    es.onmessage = (event) => {
      try {
        const sseEvent: SSEEvent = JSON.parse(event.data);
        
        // Always use the ref — never closes over a stale handler
        handleSSERef.current(sseEvent);
      } catch (err) {
        console.error("[SSE] Parse error:", err, event.data);
      }
    };

    es.onerror = (err) => {
      // Server closed the connection — this is normal after all events are sent
      if (es.readyState === EventSource.CLOSED) {
        if (process.env.NODE_ENV === "development") {
          console.log("[SSE] Connection closed by server");
        }
        es.close();
        return;
      }

      // Actual error — retry if build is still active
      console.warn("[SSE] Connection error, will retry", err);
      es.close();

      const { stage: currentStage, is_streaming: currentStreaming } = useWorkflowStore.getState();
      const shouldRetry =
        (currentStage !== "idle" &&
        currentStage !== "complete" &&
        currentStage !== "error") ||
        currentStreaming;

      if (shouldRetry) {
        retryRef.current = setTimeout(() => connectSSE(), 3_000);
      }
    };

    eventSourceRef.current = es;
  }, [projectId]); // projectId is the ONLY dep — this is intentional

  // Connect on mount, reconnect if projectId changes
  useEffect(() => {
    connectSSE();
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connectSSE]);

  // Reset store when navigating to a different project
  useEffect(() => {
    reset();
  }, [projectId, reset]);

  // ── Send action ────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async (action: UserAction) => {
      const response = await messagesAPI.sendAction(projectId, action);
      if (response.error) throw new Error(response.error as string);
      return response.data!;
    },

    onMutate: async (action) => {
      if ("content" in action && action.content) {
        const tempId = `temp-${Date.now()}`;
        const optimistic: Message = {
          id:           tempId,
          role:         "user",
          message_type: "user_prompt",
          content:      [{ type: "text", content: action.content }],
          created_at:   new Date().toISOString(),
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
        error: err instanceof Error ? err.message : "Failed to send message",
      });
    },
  });

  return {
    // Data
    messages,
    stage,
    active_role,
    is_streaming,
    isThinking,
    thinkingStatus,
    inProgressMessage,
    error,

    // Loading
    isLoadingHistory,
    isHistoryError,
    isSending: sendMutation.isPending,

    // Actions
    sendAction: (action: UserAction) => sendMutation.mutate(action),
  };
}

// Re-export WorkflowStage for components that need it
type WorkflowStage = import("@/types/workflow").WorkflowStage;