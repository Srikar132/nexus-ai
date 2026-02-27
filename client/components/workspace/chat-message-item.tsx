"use client";

import React from "react";
import type { Message } from "@/types/workflow";
import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message";

interface ChatMessageItemProps {
  message: Message;
}

export function ChatMessageItem({ message }: ChatMessageItemProps) {
  if (message.role === "user") {
    return <UserMessage message={message} />;
  }

  // All AI agents (conductor, artificer, guardian, deployer) render as AssistantMessage
  if (message.role === "conductor" || message.role === "artificer" || message.role === "guardian" || message.role === "deployer") {
    return <AssistantMessage message={message} />;
  }

  // System messages - rarely shown, but just in case
  if (message.role === "system") {
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
