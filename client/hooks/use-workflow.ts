"use client";

/**
 * hooks/use-workflow.ts
 *
 * TanStack Query  → fetches + caches message history (server data)
 * Zustand store   → owns live SSE state (stage, streaming, plan, liveMessages)
 * messagesAPI     → all CRUD — cookies sent automatically via credentials:"include"
 *
 * SSE: fetch("/api/v1/.../stream", { credentials: "include" })
 * Next.js rewrite proxies /api/v1/* → FastAPI
 * FastAPI reads authjs.session-token cookie via NextAuthJWT — no token needed here.
 */

import { useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkflowStore } from "@/store/workflow-store";
import { messagesAPI } from "@/lib/api";
import type { UserAction, Message, SSEEvent } from "@/types/workflow";

// ─── Query key factory ───────────────────────────────────────────────────────

export const workflowKeys = {
  messages: (projectId: string, offset = 0) =>
    ["messages", projectId, offset] as const,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWorkflow(projectId: string) {
  const queryClient = useQueryClient();

  // ── Zustand — live SSE state ─────────────────────────────────────────────
  const {
    stage,
    active_plan,
    streaming_text,
    active_role,
    is_streaming,
    error,
    handleSSEEvent,
    reset,
  } = useWorkflowStore();

  // ── TanStack Query — persisted message history from DB ───────────────────
  const {
    data: historyData,
    isLoading: isLoadingHistory,
    isError: isHistoryError,
  } = useQuery({
    queryKey: workflowKeys.messages(projectId),
    queryFn: async () => {
      const response = await messagesAPI.list(projectId, 0, 50);
      if (response.error) throw new Error(response.error);
      return response.data!;
    },
    enabled: !!projectId,
    staleTime: 30_000,           // fresh for 30s — SSE keeps us live anyway
    refetchOnWindowFocus: false, // SSE handles live updates, no need to refetch
  });

  // Restore stage from active_build when page loads mid-build
  useEffect(() => {
    const activeBuild = historyData?.active_build;
    if (!activeBuild || stage !== "idle") return;

    const statusToStage: Record<string, string> = {
      running:   "building",
      planning:  "planning",
      testing:   "testing",
      deploying: "deploying",
      waiting_env: "waiting_env",
    };
    const restored = statusToStage[activeBuild.status];
    if (restored) useWorkflowStore.setState({ stage: restored as any });
  }, [historyData?.active_build, stage]);

  // ── SSE connection (direct to FastAPI, bypasses Next.js proxy buffering) ──
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryRef       = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectSSE = useCallback(() => {
    // Guard: don't connect if projectId is missing or invalid
    if (!projectId || projectId === "undefined") return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Connect DIRECTLY to FastAPI (bypasses Next.js rewrite proxy buffering)
    // CORS is configured on FastAPI: allow_origins=["http://localhost:3000"], allow_credentials=True
    // withCredentials:true sends authjs.session-token cookie cross-origin
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const url = `${API_BASE}/api/v1/projects/${projectId}/messages/stream`;
    console.log("[SSE] Connecting directly to FastAPI:", url);

    const eventSource = new EventSource(url, { withCredentials: true });

    eventSource.onopen = () => {
      console.log("[SSE] Connection opened");
    };

    eventSource.onmessage = (event) => {
      try {
        console.log("[SSE] Event received:", event.data);
        const sseEvent: SSEEvent = JSON.parse(event.data);
        handleSSEEvent(sseEvent);

        // When stream ends, refresh persisted history via TanStack Query
        if (sseEvent.type === "done") {
          queryClient.invalidateQueries({
            queryKey: workflowKeys.messages(projectId),
          });
        }
      } catch (err) {
        console.error("[SSE] Failed to parse event:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("[SSE] Connection error:", err);
      eventSource.close();

      // Don't retry if we're in a stable state (done/idle) — stream closed normally
      const currentStage = useWorkflowStore.getState().stage;
      if (currentStage !== "idle" && currentStage !== "complete" && currentStage !== "error") {
        // Retry connection after 3s only if workflow is still active
        retryRef.current = setTimeout(connectSSE, 3000);
      }
    };

    eventSourceRef.current = eventSource;
  }, [projectId, handleSSEEvent, queryClient]);

  // Connect on mount, clean up on unmount / project change
  useEffect(() => {
    connectSSE();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connectSSE]);

  // Reset live state when switching projects
  useEffect(() => { reset(); }, [projectId, reset]);

  // ── Send action mutation ──────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async (action: UserAction) => {
      const response = await messagesAPI.sendAction(projectId, action);
      if (response.error) throw new Error(response.error);
      return response.data!;
    },

    onMutate: async (action) => {
      // Show user message instantly (optimistic) with a temporary ID
      if ("content" in action && action.content) {
        const tempId = `temp-${Date.now()}`;
        const optimistic: Message = {
          id:           tempId,
          role:         "user",
          message_type: "user_prompt",
          content:      [{ type: "text", content: action.content }],
          created_at:   new Date().toISOString(),
        };
        
        // Optimistically update TanStack Query cache (NOT Zustand)
        queryClient.setQueryData(
          workflowKeys.messages(projectId),
          (old: any) => ({
            ...old,
            messages: [...(old?.messages ?? []), optimistic],
          })
        );
        
        return { tempId };
      }
    },

    onSuccess: (response, action, context) => {
      // Replace temp message with real DB message ID
      if (context?.tempId) {
        queryClient.setQueryData(
          workflowKeys.messages(projectId),
          (old: any) => ({
            ...old,
            messages: (old?.messages ?? []).map((m: Message) =>
              m.id === context.tempId
                ? { ...m, id: response.user_message_id }
                : m
            ),
          })
        );
      }
    },

    onError: (err, action, context) => {
      // Remove optimistic message on error
      if (context?.tempId) {
        queryClient.setQueryData(
          workflowKeys.messages(projectId),
          (old: any) => ({
            ...old,
            messages: (old?.messages ?? []).filter(
              (m: Message) => m.id !== context.tempId
            ),
          })
        );
      }
      
      useWorkflowStore.setState({
        stage: "error",
        error: err instanceof Error ? err.message : "Failed to send",
      });
    },
  });

  // ── Merge persisted history + live streaming ──────────────────────────────
  // TanStack Query = source of truth for all saved messages
  // Zustand = ONLY for in-flight streaming text display
  // 
  // Read directly from cache to get optimistic updates instantly
  const cachedData = queryClient.getQueryData<typeof historyData>(
    workflowKeys.messages(projectId)
  );
  const messages: Message[] = cachedData?.messages ?? historyData?.messages ?? [];

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    // Data
    messages,
    stage,
    active_plan,
    streaming_text,
    active_role,
    is_streaming,
    error,

    // Loading flags
    isLoadingHistory,
    isHistoryError,
    isSending: sendMutation.isPending,

    // The ONLY way UI sends anything to the backend
    sendAction: (action: UserAction) => sendMutation.mutate(action),
  };
}
