"use client";

/**
 * components/workspace/code-panel/code-panel.tsx
 *
 * Main code panel component for the right sidebar.
 * Split view: File tree (left) + Code viewer (right)
 * 
 * Uses react-resizable-panels for the split, making it consistent
 * with the rest of the workspace layout.
 */

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FileTreeView } from "./file-tree-view";
import { CodeViewer } from "./code-viewer";
import { useCodeStore, useFileCount, useIsCodeActive } from "@/store/code-store";
import { cn } from "@/lib/utils";
import {
  Code2,
  X,
  FolderTree,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Panel Header ─────────────────────────────────────────────────────────────

function PanelHeader({ onClose }: { onClose: () => void }) {
  const fileCount = useFileCount();
  const isActive = useIsCodeActive();

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/80 shrink-0">
      <div className="flex items-center gap-2">
        <Code2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Code</span>
        {fileCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {fileCount} {fileCount === 1 ? "file" : "files"}
          </Badge>
        )}
        {isActive && (
          <div className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="text-[10px] text-primary font-medium">Building</span>
          </div>
        )}
        {!isActive && fileCount > 0 && (
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span className="text-[10px] text-green-500 font-medium">Done</span>
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onClose}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── File tree header ─────────────────────────────────────────────────────────

function TreeHeader() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-muted/20 shrink-0">
      <FolderTree className="h-3 w-3 text-muted-foreground" />
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        Explorer
      </span>
    </div>
  );
}

// ─── CodePanel component ──────────────────────────────────────────────────────

interface CodePanelProps {
  onClose: () => void;
  className?: string;
}

export function CodePanel({ onClose, className }: CodePanelProps) {
  const fileCount = useFileCount();

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <PanelHeader onClose={onClose} />

      {/* Split: File tree + Code viewer */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          {/* File Tree */}
          <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
            <div className="flex flex-col h-full border-r border-border">
              <TreeHeader />
              <div className="flex-1 overflow-auto">
                <FileTreeView />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Code Viewer */}
          <ResizablePanel defaultSize={70} minSize={40}>
            <CodeViewer />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
