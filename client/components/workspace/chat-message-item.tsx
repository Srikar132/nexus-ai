"use client";

import React from "react";
import type { Message, UserAction } from "@/types/workflow";
import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message";

interface ChatMessageItemProps {
  message: Message;
  projectId?: string;
  sendAction?: (action: UserAction) => void;
}

export function ChatMessageItem({ message, projectId, sendAction }: ChatMessageItemProps) {
  if (message.role === "user") {
    return <UserMessage message={message} />;
  }

  // All AI agents (conductor, artificer, guardian, deployer) render as AssistantMessage
  if (message.role === "conductor" || message.role === "artificer" || message.role === "guardian" || message.role === "deployer") {
    return <AssistantMessage message={message} projectId={projectId} sendAction={sendAction} />;
  }

  // System messages that contain artifacts (e.g. connect_railway, env_var_request)
  // should be rendered as AssistantMessage so the ArtifactCard is displayed.
  if (message.role === "system") {
    const hasArtifact = message.content.some(
      (block) => block.type === "artifact" && block.artifact_data
    );
    if (hasArtifact) {
      return <AssistantMessage message={message} projectId={projectId} sendAction={sendAction} />;
    }

    return (
      <div className="flex justify-center py-2">
        <div className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content[0]?.type === "text" && message.content[0].content}
        </div>
      </div>
    );
  }

  return null;
}
