"use client";

import React from "react";
import type { Message } from "@/types/workflow";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Rocket } from "lucide-react";

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

  // Check if this is an env vars submission message
  const isEnvVarSubmission = textContent.includes("environment variables for deployment");

  return (
    <div className="py-2 flex flex-col items-end max-w-[75%] ml-auto">
      {/* User Avatar and Label at the top */}
      <div className="flex items-center gap-2 mb-2">
        <div className="text-xs font-medium text-muted-foreground">You</div>
        <Avatar className="size-6 shrink-0">
          <AvatarFallback className="bg-muted">
            <User className="size-3" />
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Message Content */}
      <div className={`rounded-2xl rounded-tr-sm px-3 py-2 ${
        isEnvVarSubmission 
          ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20" 
          : "bg-primary text-primary-foreground"
      }`}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word flex items-center gap-2">
          {isEnvVarSubmission && <Rocket className="size-3.5 shrink-0" />}
          {textContent}
        </p>
      </div>
    </div>
  );
}
