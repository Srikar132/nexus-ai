"use client";

/**
 * components/step-feed.tsx
 *
 * Renders the Copilot-style step timeline during agent execution.
 *
 * Each "step" event appends a new row — they never replace each other.
 * Within each step row, the tool_call input and tool_result are shown
 * as an expandable sub-section.
 *
 * Visual hierarchy:
 *   ● Writing app.py...          ← step status (always visible)
 *     ↳ input: {"path":"app.py"} ← tool_call detail (expandable)
 *     ↳ result: "OK, wrote 42..."← tool_result (shown when done)
 */

import React, { useState } from "react";
import {
  ChevronDown, ChevronRight, CheckCircle2, Loader2,
  AlertCircle, Terminal, FileText, Globe, Shield,
  Rocket, Search, Zap,
} from "lucide-react";
import type { StepFeedItem } from "@/types/workflow";
import { cn } from "@/lib/utils";

interface StepFeedProps {
  steps:    StepFeedItem[];
  role:     string;
  className?: string;
}

// Tool name → icon mapping
function ToolIcon({ tool }: { tool: string }) {
  const t = tool.toLowerCase();
  if (t.includes("file") || t.includes("write") || t.includes("read")) {
    return <FileText className="size-3 shrink-0" />;
  }
  if (t.includes("exec") || t.includes("command") || t.includes("run")) {
    return <Terminal className="size-3 shrink-0" />;
  }
  if (t.includes("http") || t.includes("request") || t.includes("probe")) {
    return <Globe className="size-3 shrink-0" />;
  }
  if (t.includes("scan") || t.includes("security") || t.includes("auth")) {
    return <Shield className="size-3 shrink-0" />;
  }
  if (t.includes("deploy") || t.includes("railway") || t.includes("github")) {
    return <Rocket className="size-3 shrink-0" />;
  }
  if (t.includes("list") || t.includes("search")) {
    return <Search className="size-3 shrink-0" />;
  }
  return <Zap className="size-3 shrink-0" />;
}

function StepRow({ step }: { step: StepFeedItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!(step.input || step.result);
  const isDone    = step.state === "done";
  const isError   = step.is_error;

  return (
    <div className="group flex flex-col">
      {/* Main step row */}
      <button
        onClick={() => hasDetail && setExpanded((v) => !v)}
        disabled={!hasDetail}
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-lg text-left w-full",
          "transition-colors duration-150",
          hasDetail && "hover:bg-muted/60 cursor-pointer",
          !hasDetail && "cursor-default",
        )}
      >
        {/* Status icon */}
        <span className="shrink-0">
          {isDone && !isError && (
            <CheckCircle2 className="size-3.5 text-emerald-500" />
          )}
          {isDone && isError && (
            <AlertCircle className="size-3.5 text-destructive" />
          )}
          {!isDone && (
            <Loader2 className="size-3.5 text-primary animate-spin" />
          )}
        </span>

        {/* Tool icon */}
        <span className={cn(
          "shrink-0",
          isDone && !isError ? "text-emerald-500/70" : "text-muted-foreground/60",
        )}>
          <ToolIcon tool={step.tool} />
        </span>

        {/* Status text */}
        <span className={cn(
          "text-xs flex-1 truncate",
          isDone && !isError && "text-muted-foreground",
          isDone && isError  && "text-destructive",
          !isDone            && "text-foreground",
        )}>
          {step.status}
        </span>

        {/* Expand chevron */}
        {hasDetail && (
          <span className="shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">
            {expanded
              ? <ChevronDown className="size-3" />
              : <ChevronRight className="size-3" />}
          </span>
        )}
      </button>

      {/* Expandable detail section */}
      {expanded && hasDetail && (
        <div className="ml-7 mb-1 flex flex-col gap-1">
          {/* Tool input */}
          {step.input && (
            <div className="rounded-md bg-muted/40 border border-border/50 overflow-hidden">
              <div className="px-2 py-0.5 text-[10px] font-medium text-muted-foreground/60 border-b border-border/30 bg-muted/20">
                input
              </div>
              <pre className="px-2 py-1.5 text-[10px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                {step.input}
              </pre>
            </div>
          )}

          {/* Tool result */}
          {step.result && (
            <div className={cn(
              "rounded-md border overflow-hidden",
              step.is_error
                ? "bg-destructive/5 border-destructive/20"
                : "bg-emerald-500/5 border-emerald-500/20",
            )}>
              <div className={cn(
                "px-2 py-0.5 text-[10px] font-medium border-b",
                step.is_error
                  ? "text-destructive/60 border-destructive/20 bg-destructive/5"
                  : "text-emerald-600/60 border-emerald-500/20 bg-emerald-500/5",
              )}>
                {step.is_error ? "error" : "result"}
              </div>
              <pre className={cn(
                "px-2 py-1.5 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap break-all",
                step.is_error ? "text-destructive/80" : "text-muted-foreground",
              )}>
                {step.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StepFeed({ steps, role, className }: StepFeedProps) {
  if (steps.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {/* Agent label */}
      <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider px-2 mb-0.5">
        {role} — steps
      </p>

      {steps.map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
    </div>
  );
}