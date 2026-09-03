"use client";

/**
 * thinking-indicator.tsx
 *
 * Shown in the chat between the user sending a message and
 * the first SSE text_chunk arriving. Fills the 3-5 second gap
 * with animated "thinking" status messages so the UI feels alive.
 *
 * States cycle through messages like:
 *   "Analyzing your request..."
 *   "Understanding your requirements..."
 *   "Preparing response..."
 */

import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Brain, Sparkles, Zap } from "lucide-react";

const THINKING_MESSAGES = [
  { text: "Analyzing your request...", icon: Brain },
  { text: "Understanding your requirements...", icon: Sparkles },
  { text: "Preparing response...", icon: Zap },
  { text: "Working on it...", icon: Bot },
];

interface ThinkingIndicatorProps {
  status?: string | null;
}

export function ThinkingIndicator({ status }: ThinkingIndicatorProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  // Cycle through thinking messages every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % THINKING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const current = THINKING_MESSAGES[messageIndex];
  const Icon = current.icon;
  const displayText = status || current.text;

  return (
    <div className="py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Avatar + Label row */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative">
          <Avatar className="size-6 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary">
              <Bot className="size-3" />
            </AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-primary animate-pulse" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          NexusAI
        </span>
      </div>

      {/* Thinking bubble */}
      <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3 w-fit max-w-70">
        <div className="flex items-center gap-2.5">
          {/* Animated icon */}
          <div className="shrink-0">
            <Icon className="size-3.5 text-primary/70 animate-pulse" />
          </div>

          {/* Status text */}
          <span
            className="text-sm text-muted-foreground animate-in fade-in duration-300"
            key={displayText}
          >
            {displayText}
          </span>
        </div>

        {/* Animated dots bar */}
        <div className="flex items-center gap-1 mt-2">
          <div className="h-0.5 rounded-full bg-primary/30 animate-pulse w-8" />
          <div className="h-0.5 rounded-full bg-primary/20 animate-pulse w-12 [animation-delay:150ms]" />
          <div className="h-0.5 rounded-full bg-primary/10 animate-pulse w-6 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
