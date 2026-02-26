"use client";

import React from "react";
import type { Message } from "@/types/workflow";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot } from "lucide-react";
import { MarkdownContent } from "./markdown-content";
import { ArtifactCard } from "./artifact-card";

interface AssistantMessageProps {
  message: Message;
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  return (
    <div className="flex items-start gap-3 py-4">
      {/* AI Avatar */}
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-primary/10 text-primary">
          <Bot className="size-4" />
        </AvatarFallback>
      </Avatar>

      {/* Message Content */}
      <div className="flex-1 space-y-3">
        <div className="text-xs font-medium text-muted-foreground">
          NexusAI
        </div>

        {/* Render all content blocks */}
        {message.content.map((block, idx) => {
          if (block.type === "text") {
            return (
              <div
                key={idx}
                className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[95%]"
              >
                <MarkdownContent content={block.content} />
              </div>
            );
          }

          if (block.type === "artifact" && block.artifact_data) {
            return (
              <ArtifactCard
                key={idx}
                artifactType={block.artifact_data.artifact_type}
                title={block.artifact_data.title}
                content={block.artifact_data.content}
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
