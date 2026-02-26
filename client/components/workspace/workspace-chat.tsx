"use client";

/**
 * workspace-chat.tsx
 *
 * Clean rendering logic:
 *  1. messages[]          → all committed messages (history + streamed)
 *  2. inProgressMessage   → the one being built right now, shown at bottom
 *
 * No complex conditional logic — if inProgressMessage exists, show it.
 * When "done" fires, Zustand commits it to messages[] and clears inProgressMessage.
 * React re-renders: StreamingMessage disappears, ChatMessageItem appears. Seamless.
 */

import React, { useEffect, useRef } from "react";
import { WorkspacePromptInput } from "./workspace-prompt-input";
import { ChatMessageItem } from "./chat-message-item";
import { StreamingMessage } from "./streaming-message";
import type { Message, UserAction, WorkflowStage, Plan } from "@/types/workflow";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InProgressMessage {
  role: string;
  text: string;
  artifact: { artifact_type: string; title: string; content: unknown } | null;
}

interface WorkspaceChatProps {
  projectId: string;
  messages: Message[];
  stage: WorkflowStage;
  active_plan: Plan | null;
  inProgressMessage: InProgressMessage | null;
  active_role: string | null;
  is_streaming: boolean;
  error: string | null;
  isLoadingHistory: boolean;
  isHistoryError: boolean;
  isSending: boolean;
  sendAction: (action: UserAction) => void;
}

const WorkspaceChat = ({
  projectId,
  messages,
  inProgressMessage,
  is_streaming,
  error,
  isLoadingHistory,
  isSending,
  sendAction,
}: WorkspaceChatProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on any new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, inProgressMessage?.text]);

  const handleSubmit = (content: string) => {
    if (!content.trim()) return;
    sendAction({ action: "send_message", content: content.trim() });
  };

  const isEmpty = !isLoadingHistory && messages.length === 0 && !inProgressMessage;

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

          {/* ── Committed messages (history + previously streamed) ── */}
          {messages.map((message) => (
            <ChatMessageItem key={message.id} message={message} />
          ))}

          {/* ── Live in-progress message ── */}
          {/* Exists from agent_start until "done" commits it.           */}
          {/* Seamlessly replaced by the ChatMessageItem above on commit. */}
          {inProgressMessage && (
            <StreamingMessage
              inProgressMessage={inProgressMessage}
              isStreaming={is_streaming}
            />
          )}

          {/* Empty state */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Loader2 className="size-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Start Building with NexusAI</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Describe what you want to build, request a plan, or ask for modifications.
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
            isProcessing={isSending || is_streaming}
            placeholder="Ask NexusAI to build, modify, or explain..."
          />
        </div>
      </div>
    </aside>
  );
};

export default WorkspaceChat;