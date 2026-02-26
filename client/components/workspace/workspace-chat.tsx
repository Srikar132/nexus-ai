"use client";

import React, { useEffect, useRef } from "react";
import { WorkspacePromptInput } from "./workspace-prompt-input";
import { ChatMessageItem } from "./chat-message-item";
import { StreamingMessage } from "./streaming-message";
import type { Message, UserAction, WorkflowStage, Plan } from "@/types/workflow";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WorkspaceChatProps {
  // Project ID for auto-populate
  projectId: string;
  
  // Data from useWorkflow hook
  messages: Message[];
  stage: WorkflowStage;
  active_plan: Plan | null;
  streaming_text: string;
  active_role: string | null;
  is_streaming: boolean;
  error: string | null;
  
  // Loading states
  isLoadingHistory: boolean;
  isHistoryError: boolean;
  isSending: boolean;
  
  // Actions
  sendAction: (action: UserAction) => void;
}

const WorkspaceChat = ({
  projectId,
  messages,
  stage,
  active_plan,
  streaming_text,
  active_role,
  is_streaming,
  error,
  isLoadingHistory,
  isHistoryError,
  isSending,
  sendAction,
}: WorkspaceChatProps) => {
  // Auto-scroll to bottom on new messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming_text]);

  // Debug logging
  useEffect(() => {
    console.log("[WorkspaceChat] State update:", {
      is_streaming,
      active_role,
      streaming_text_length: streaming_text.length,
      streaming_text_preview: streaming_text.substring(0, 50) + (streaming_text.length > 50 ? "..." : "")
    });
  }, [is_streaming, active_role, streaming_text]);

  // Handle message submission
  const handleSubmit = (content: string) => {
    if (!content.trim()) return;
    
    sendAction({
      action: "send_message",
      content: content.trim(),
    });
  };

  return (
    <aside className="w-full h-full overflow-hidden flex flex-col gap-1">
      {/* Debug info - temporary */}
      <div className="bg-yellow-50 p-2 text-xs text-black border-b">
        <div>is_streaming: {String(is_streaming)}</div>
        <div>active_role: {active_role || 'null'}</div>
        <div>streaming_text length: {streaming_text.length}</div>
        <div>stage: {stage}</div>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide px-4">
        <div className="max-w-3xl mx-auto py-4 space-y-2">
          {/* Loading State */}
          {isLoadingHistory && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Render persisted messages */}
          {messages.map((message) => (
            <ChatMessageItem key={message.id} message={message} />
          ))}

          {/* Render live streaming message when agent is active or streaming */}
          {(is_streaming || active_role || streaming_text) && (
            <StreamingMessage
              content={streaming_text}
              activeRole={active_role}
            />
          )}

          {/* Empty state */}
          {!isLoadingHistory && messages.length === 0 && !is_streaming && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Loader2 className="size-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Start Building with NexusAI
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Describe what you want to build, request a plan, or ask for
                modifications to your project.
              </p>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="shrink-0 p-3 sm:p-4 bg-card/10 border-t">
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