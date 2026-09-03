"use client";

/**
 * components/workspace/code-panel/file-tree-view.tsx
 *
 * File tree using react-arborist.
 * Displays files created by the coding agent in a VSCode-like tree structure.
 * Files appear with animation as the agent creates them.
 */

import { useRef, useEffect } from "react";
import { Tree, NodeRendererProps } from "react-arborist";
import { TreeNode, useCodeStore } from "@/store/code-store";
import {
  File,
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  Database,
  Cog,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ─── File icon mapping ────────────────────────────────────────────────────────

function getFileIcon(name: string, language?: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const iconClass = "h-4 w-4 shrink-0";

  // By extension
  switch (ext) {
    case "py":
      return <FileCode className={cn(iconClass, "text-yellow-500")} />;
    case "js":
    case "jsx":
      return <FileCode className={cn(iconClass, "text-yellow-400")} />;
    case "ts":
    case "tsx":
      return <FileCode className={cn(iconClass, "text-blue-500")} />;
    case "json":
      return <FileJson className={cn(iconClass, "text-amber-400")} />;
    case "md":
      return <FileText className={cn(iconClass, "text-slate-400")} />;
    case "sql":
      return <Database className={cn(iconClass, "text-orange-400")} />;
    case "yaml":
    case "yml":
    case "toml":
    case "ini":
    case "cfg":
    case "env":
      return <Cog className={cn(iconClass, "text-gray-400")} />;
    case "html":
      return <FileCode className={cn(iconClass, "text-orange-500")} />;
    case "css":
    case "scss":
      return <FileCode className={cn(iconClass, "text-blue-400")} />;
    default:
      return <File className={cn(iconClass, "text-muted-foreground")} />;
  }
}

// ─── Tree Node renderer ───────────────────────────────────────────────────────

function Node({ node, style, dragHandle }: NodeRendererProps<TreeNode>) {
  const selectedFile = useCodeStore((s) => s.selectedFile);
  const selectFile = useCodeStore((s) => s.selectFile);
  const isSelected = node.data.filePath === selectedFile;
  const isFolder = !node.data.isLeaf;
  const isWriting = node.data.status === "writing";

  const handleClick = () => {
    if (isFolder) {
      node.toggle();
    } else if (node.data.filePath) {
      selectFile(node.data.filePath);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={style}
      ref={dragHandle}
      className={cn(
        "flex items-center gap-1.5 px-2 py-[3px] cursor-pointer rounded-sm text-sm",
        "hover:bg-accent/50 transition-colors duration-150",
        isSelected && "bg-accent text-accent-foreground font-medium",
        isWriting && "animate-pulse"
      )}
      onClick={handleClick}
    >
      {/* Folder / File icon */}
      {isFolder ? (
        node.isOpen ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-blue-400" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-blue-400" />
        )
      ) : (
        getFileIcon(node.data.name, node.data.language)
      )}

      {/* Name */}
      <span className="truncate text-[13px]">{node.data.name}</span>

      {/* Writing indicator */}
      {isWriting && (
        <Loader2 className="h-3 w-3 ml-auto animate-spin text-primary shrink-0" />
      )}
    </motion.div>
  );
}

// ─── FileTreeView component ───────────────────────────────────────────────────

interface FileTreeViewProps {
  className?: string;
}

export function FileTreeView({ className }: FileTreeViewProps) {
  const treeData = useCodeStore((s) => s.getTreeData());
  const fileCount = useCodeStore((s) => s.files.size);
  const isActive = useCodeStore((s) => s.isActive);
  const treeRef = useRef<any>(null);

  // Auto-open all folders when new files are added
  useEffect(() => {
    if (treeRef.current) {
      treeRef.current.openAll();
    }
  }, [fileCount]);

  if (fileCount === 0 && !isActive) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full p-4", className)}>
        <File className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-xs text-muted-foreground text-center">
          No files yet. The coding agent will create files here.
        </p>
      </div>
    );
  }

  if (fileCount === 0 && isActive) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full p-4", className)}>
        <Loader2 className="h-6 w-6 text-primary animate-spin mb-2" />
        <p className="text-xs text-muted-foreground text-center">
          Agent is setting up the environment...
        </p>
      </div>
    );
  }

  return (
    <div className={cn("h-full overflow-hidden", className)}>
      <Tree<TreeNode>
        ref={treeRef}
        data={treeData}
        openByDefault={true}
        width="100%"
        height={1000}
        indent={16}
        rowHeight={28}
        overscanCount={5}
        disableDrag
        disableDrop
      >
        {Node}
      </Tree>
    </div>
  );
}
