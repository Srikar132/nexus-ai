"use client";

/**
 * hooks/use-workflow.ts
 *
 * TanStack Query  → fetches + caches message history (server data)
 * Zustand store   → owns live SSE state (stage, streaming, plan, liveMessages)
 * messageService  → all CRUD — cookies sent automatically via credentials:"include"
 *
 * SSE: fetch("/api/v1/.../stream", { credentials: "include" })
 * Next.js rewrite proxies /api/v1/* → FastAPI
 * FastAPI reads authjs.session-token cookie via NextAuthJWT — no token needed here.
 */

import { useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkflowStore } from "@/store/workflow-store";
import messageService from "@/lib/services/message-service";
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
    activePlan,
    streamingText,
    activeRole,
    isStreaming,
    error,
    liveMessages,
    handleSSEEvent,
    addOptimisticMessage,
    reset,
  } = useWorkflowStore();

  // ── TanStack Query — persisted message history from DB ───────────────────
  const {
    data: historyData,
    isLoading: isLoadingHistory,
    isError: isHistoryError,
  } = useQuery({
    queryKey: workflowKeys.messages(projectId),
    queryFn: () => messageService.getMessages(projectId, 0, 50),
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

  // ── SSE connection ────────────────────────────────────────────────────────
  const abortRef    = useRef<AbortController | null>(null);
  const retryRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectSSE = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    fetch(`/api/v1/projects/${projectId}/messages/stream`, {
      credentials: "include",                    // sends authjs.session-token cookie
      signal:      abortRef.current.signal,
      headers:     { Accept: "text/event-stream" },
    })
      .then((res) => {
        if (!res.ok || !res.body) return;

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let   buffer  = "";

        const read = () => {
          reader.read().then(({ done, value }) => {
            if (done) return;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";

            for (const part of parts) {
              const dataLine = part.split("\n").find((l) => l.startsWith("data:"));
              if (!dataLine) continue;
              try {
                const event: SSEEvent = JSON.parse(dataLine.slice(5).trim());
                handleSSEEvent(event);

                // When stream ends, refresh persisted history via TanStack Query
                if (event.type === "done") {
                  queryClient.invalidateQueries({
                    queryKey: workflowKeys.messages(projectId),
                  });
                }
              } catch {
                // skip malformed frames
              }
            }
            read();
          }).catch((err) => {
            if ((err as Error).name === "AbortError") return;
            retryRef.current = setTimeout(connectSSE, 3000); // reconnect on drop
          });
        };

        read();
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        retryRef.current = setTimeout(connectSSE, 3000);
      });
  }, [projectId, handleSSEEvent, queryClient]);

  // Connect on mount, clean up on unmount / project change
  useEffect(() => {
    connectSSE();
    return () => {
      abortRef.current?.abort();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connectSSE]);

  // Reset live state when switching projects
  useEffect(() => { reset(); }, [projectId, reset]);

  // ── Send action mutation ──────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (action: UserAction) =>
      messageService.sendAction(projectId, action),

    onMutate: (action) => {
      // Show user message instantly (optimistic) before server responds
      if ("content" in action && action.content) {
        const optimistic: Message = {
          id:           crypto.randomUUID(),
          role:         "user",
          message_type: "user_prompt",
          content:      [{ type: "text", content: action.content }],
          created_at:   new Date().toISOString(),
        };
        addOptimisticMessage(optimistic);
      }
    },

    onError: (err) => {
      useWorkflowStore.setState({
        stage: "error",
        error: err instanceof Error ? err.message : "Failed to send",
      });
    },
  });

  // ── Merge persisted history + live messages ───────────────────────────────
  // Deduplicate by id — optimistic messages disappear once TanStack Query
  // refreshes and the DB version comes back.
  const messages: Message[] = (() => {
    const persisted = historyData?.messages ?? [];
    const liveIds   = new Set(liveMessages.map((m) => m.id));
    return [
      ...persisted.filter((m) => !liveIds.has(m.id)),
      ...liveMessages,
    ];
  })();

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    // Data
    messages,
    stage,
    activePlan,
    streamingText,
    activeRole,
    isStreaming,
    error,

    // Loading flags
    isLoadingHistory,
    isHistoryError,
    isSending: sendMutation.isPending,

    // The ONLY way UI sends anything to the backend
    sendAction: (action: UserAction) => sendMutation.mutate(action),
  };
}
