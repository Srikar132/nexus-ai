"use client";

/**
 * streaming-message.tsx
 *
 * Renders the inProgressMessage while it's being assembled from SSE chunks.
 *
 * KEY FIX — why text appeared all at once before:
 *   The component itself was correct. The bug was in use-workflow.ts where
 *   connectSSE was recreated on every SSE event (because handleSSEEvent was
 *   in useCallback deps), causing constant disconnect/reconnect. Now that
 *   the SSE connection is stable, this component receives incremental updates
 *   and renders each chunk as it arrives.
 *
 * States handled:
 *   1. agent_start fired, no chunks yet     → bouncing dots (thinking)
 *   2. text_chunk arriving                  → text + blinking cursor
 *   3. artifact received (env_var_request)  → ArtifactCard + optional text
 *   4. agent_done, awaiting "done" event    → full text, no cursor (frozen)
 *   5. "done" fires                         → parent removes this component,
 *                                              committed ChatMessageItem appears
 *
 * The transition from state 4→5 is seamless because:
 *   - Zustand commits inProgressMessage.text to messages[] on "done"
 *   - inProgressMessage becomes null
 *   - React removes <StreamingMessage />, adds <ChatMessageItem />
 *   - Both render identical text so there's no visual jump
 */

import React, { memo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Loader2 } from "lucide-react";
import { MarkdownContent } from "./markdown-content";
import { ArtifactCard } from "./artifact-card";
import type { InProgressMessage } from "@/store/workflow-store";

interface StreamingMessageProps {
  inProgressMessage: InProgressMessage;
  isStreaming:       boolean;   // true while text_chunk events are arriving
  isThinking:        boolean;   // true while thinking events are arriving
  thinkingStatus:    string | null;
}

export const StreamingMessage = memo(function StreamingMessage({
  inProgressMessage,
  isStreaming,
  isThinking,
  thinkingStatus,
}: StreamingMessageProps) {
  const { role, text, artifact } = inProgressMessage;
  const hasText     = text.trim().length > 0;
  const hasArtifact = artifact !== null;
  const hasContent  = hasText || hasArtifact;
  const isActive    = isStreaming || isThinking;

  return (
    <div className="py-2 animate-in fade-in duration-200">
      {/* Agent label + activity indicator */}
      <div className="flex items-center gap-2 mb-2">
        <Avatar className="size-6 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary">
            <Bot className="size-3" />
          </AvatarFallback>
        </Avatar>

        <span className="text-xs font-medium text-muted-foreground capitalize">
          {role}
        </span>

        {/* Spinner while agent is active */}
        {isActive && (
          <Loader2 className="size-3 animate-spin text-primary/60" />
        )}

        {/* Live pulse dot on avatar when streaming */}
        {isStreaming && (
          <span className="size-2 rounded-full bg-primary animate-pulse" />
        )}
      </div>

      <div className="space-y-2">
        {!hasContent ? (
          /* No content yet — show thinking status or bouncing dots */
          <div className="flex flex-col gap-1.5">
            {isThinking && thinkingStatus ? (
              /* Dynamic thinking status from backend */
              <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 rounded-2xl rounded-tl-sm w-fit text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin shrink-0" />
                <span>{thinkingStatus}</span>
              </div>
            ) : (
              /* Fallback bouncing dots */
              <div className="flex items-center gap-1.5 px-4 py-3 bg-muted/50 rounded-2xl rounded-tl-sm w-fit">
                <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:120ms]" />
                <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:240ms]" />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-w-[95%]">
            {/* Artifact card (env_var_request, connect_railway, etc.) */}
            {hasArtifact && artifact && (
              <ArtifactCard
                artifactType={artifact.artifact_type}
                title={artifact.title}
                content={artifact.content}
              />
            )}

            {/* Streaming text with blinking cursor */}
            {hasText && (
              <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3">
                <MarkdownContent content={text} />
                {/* Cursor only while chunks actively arriving */}
                {isStreaming && (
                  <span className="inline-block w-[2px] h-[1em] bg-primary/80 animate-pulse ml-0.5 align-middle" />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});