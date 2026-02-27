"use client";

/**
 * streaming-message.tsx
 *
 * Renders the inProgressMessage while it's being assembled from SSE chunks.
 * This is a pure display component — it just shows what's in the store.
 *
 * States:
 *  1. agent_start fired, no chunks yet → show "Thinking..." dots
 *  2. text_chunk arriving             → show text with blinking cursor
 *  3. artifact received               → show artifact card (+ text if any)
 *  4. agent_done, waiting for "done"  → show full text, no cursor (frozen preview)
 *  5. "done" fires                    → parent removes this, committed msg appears
 */

import React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Loader2 } from "lucide-react";
import { MarkdownContent } from "./markdown-content";
import { ArtifactCard } from "./artifact-card";

interface InProgressMessage {
  role: string;
  text: string;
  artifact: { artifact_type: string; title: string; content: unknown } | null;
}

interface StreamingMessageProps {
  inProgressMessage: InProgressMessage;
  isStreaming: boolean; // true while chunks actively arriving
}

export function StreamingMessage({
  inProgressMessage,
  isStreaming,
}: StreamingMessageProps) {
  const { role, text, artifact } = inProgressMessage;
  const hasContent = text.trim() || artifact;

  return (
    <div className="flex items-start gap-3 py-4 animate-in fade-in duration-200">
      {/* Avatar with live pulse indicator */}
      <div className="relative shrink-0">
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary/10 text-primary">
            <Bot className="size-4" />
          </AvatarFallback>
        </Avatar>
        {isStreaming && (
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-primary animate-pulse" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2 min-w-0">
        {/* Role label + spinner */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground capitalize">
            {role}
          </span>
          {isStreaming && (
            <Loader2 className="size-3 animate-spin text-primary/60" />
          )}
        </div>

        {!hasContent ? (
          /* No content yet — bouncing dots */
          <div className="flex items-center gap-1.5 px-4 py-3 bg-muted/50 rounded-2xl rounded-tl-sm w-fit">
            <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
            <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:120ms]" />
            <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:240ms]" />
          </div>
        ) : (
          <div className="space-y-2 max-w-[95%]">
            {/* Artifact card (e.g. plan) */}
            {artifact && (
              <ArtifactCard
                artifactType={artifact.artifact_type}
                title={artifact.title}
                content={artifact.content}
              />
            )}

            {/* Streaming text */}
            {text.trim() && (
              <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3">
                <MarkdownContent content={text} />
                {/* Blinking cursor — only while chunks still arriving */}
                {isStreaming && (
                  <span className="inline-block w-[3px] h-[14px] bg-primary/80 animate-pulse ml-0.5 align-middle" />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}