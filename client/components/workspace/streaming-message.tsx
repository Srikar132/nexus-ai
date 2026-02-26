"use client";

import React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Loader2 } from "lucide-react";
import { MarkdownContent } from "./markdown-content";

interface StreamingMessageProps {
  content: string;
  activeRole: string | null;
}

export function StreamingMessage({ content, activeRole }: StreamingMessageProps) {
  // Show streaming message if there's an active role OR content
  if (!content && !activeRole) return null;

  return (
    <div className="flex items-start gap-3 py-4 animate-in fade-in duration-300">
      {/* AI Avatar with pulse animation */}
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-primary/10 text-primary">
          <Bot className="size-4" />
        </AvatarFallback>
      </Avatar>

      {/* Streaming Content */}
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-muted-foreground">
            NexusAI {activeRole && `(${activeRole})`}
          </div>
          <Loader2 className="size-3 animate-spin text-primary" />
        </div>

        {content ? (
          <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[95%]">
            <MarkdownContent content={content} />
            {/* Typing cursor */}
            <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5" />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
}
