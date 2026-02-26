"use client";

import React from "react";
import type { Message } from "@/types/workflow";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";

interface UserMessageProps {
  message: Message;
}

export function UserMessage({ message }: UserMessageProps) {
  // Extract text content
  const textContent = message.content
    .filter((c) => c.type === "text")
    .map((c) => c.content)
    .join(" ");

  if (!textContent) return null;

  return (
    <div className="flex items-start gap-3 py-4">
      {/* User Avatar */}
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-muted">
          <User className="size-4" />
        </AvatarFallback>
      </Avatar>

      {/* Message Content */}
      <div className="flex-1 space-y-1">
        <div className="text-xs font-medium text-muted-foreground">You</div>
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
          <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
            {textContent}
          </p>
        </div>
      </div>
    </div>
  );
}
