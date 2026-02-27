"use client";

/**
 * workspace-chat.tsx
 *
 * KEY FIXES:
 *  1. StreamingMessage now receives isThinking + thinkingStatus so it can
 *     display the dynamic backend status text ("Analysing your request...",
 *     "Running security scans...", etc.) instead of just bouncing dots.
 *     Previously these props weren't passed down.
 *
 *  2. Thinking indicator in the main scroll area is removed — it was a
 *     duplicate. StreamingMessage handles thinking display internally now.
 *     Keeping both caused double-spinners during the building phase.
 *
 *  3. isProcessing on the input disables it during thinking AND streaming,
 *     not just isSending. Prevents double-submits during long builds.
 */

import React, { useEffect, useRef } from "react";
import { WorkspacePromptInput } from "./workspace-prompt-input";
import { ChatMessageItem } from "./chat-message-item";
import { StreamingMessage } from "./streaming-message";
import type { Message, UserAction, WorkflowStage } from "@/types/workflow";
import type { InProgressMessage } from "@/store/workflow-store";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WorkspaceChatProps {
  projectId:         string;
  messages:          Message[];
  stage:             WorkflowStage;
  inProgressMessage: InProgressMessage | null;
  active_role:       string | null;
  is_streaming:      boolean;
  isThinking:        boolean;
  thinkingStatus:    string | null;
  error:             string | null;
  isLoadingHistory:  boolean;
  isHistoryError:    boolean;
  isSending:         boolean;
  sendAction:        (action: UserAction) => void;
}

const WorkspaceChat = ({
  projectId,
  messages,
  stage,
  inProgressMessage,
  is_streaming,
  isThinking,
  thinkingStatus,
  error,
  isLoadingHistory,
  isSending,
  sendAction,
}: WorkspaceChatProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on any new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, inProgressMessage?.text, isThinking]);

  const handleSubmit = (content: string) => {
    if (!content.trim()) return;
    sendAction({ action: "send_message", content: content.trim() });
  };

  const isEmpty =
    !isLoadingHistory &&
    messages.length === 0 &&
    !inProgressMessage &&
    !isThinking;

  // Input should be disabled any time the pipeline is active
  const isBusy = isSending || is_streaming || isThinking ||
    ["building", "testing", "fixing", "deploying"].includes(stage);

  return (
    <aside className="w-full h-full overflow-hidden flex flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide px-4">
        <div className="max-w-3xl mx-auto py-4 space-y-2">

          {/* Initial load spinner */}
          {isLoadingHistory && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error banner */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* ── Committed messages (history + previously streamed) ─────────── */}
          {messages.map((message) => (
            <ChatMessageItem key={message.id} message={message} />
          ))}

          {/* ── Live in-progress message ───────────────────────────────────── */}
          {/* Shown while agent is active. Disappears when "done" fires and    */}
          {/* the committed ChatMessageItem takes its place.                   */}
          {inProgressMessage ? (
            <StreamingMessage
              inProgressMessage={inProgressMessage}
              isStreaming={is_streaming}
              isThinking={isThinking}
              thinkingStatus={thinkingStatus}
            />
          ) : isThinking && thinkingStatus ? (
            /* Thinking has started but agent_start hasn't fired yet —
               show a minimal indicator so there's no dead silence */
            <div className="flex items-center gap-2 py-3 px-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin shrink-0" />
              <span className="animate-pulse">{thinkingStatus}</span>
            </div>
          ) : null}

          {/* Empty state */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Bot className="size-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Start Building with NexusAI</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Describe what you want to build and the AI agents will handle
                everything — from coding to testing to deployment.
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 p-3 sm:p-4 bg-card/10">
        <div className="max-w-3xl mx-auto">
          <WorkspacePromptInput
            projectId={projectId}
            onSubmit={handleSubmit}
            isProcessing={isBusy}
            placeholder={
              isBusy
                ? "Build in progress — please wait..."
                : "Ask NexusAI to build, modify, or explain..."
            }
          />
        </div>
      </div>
    </aside>
  );
};

// Missing import for empty state icon
import { Bot } from "lucide-react";

export default WorkspaceChat;