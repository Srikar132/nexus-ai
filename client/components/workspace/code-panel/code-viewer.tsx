"use client";

/**
 * components/workspace/code-panel/code-viewer.tsx
 *
 * Displays the content of the selected file with syntax highlighting.
 * Shows a streaming indicator if the file is still being written.
 * Uses react-syntax-highlighter for code highlighting.
 */

import { useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useSelectedFile, CodeFile } from "@/store/code-store";
import { cn } from "@/lib/utils";
import {
  FileCode,
  Copy,
  Check,
  Loader2,
  FileX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// ─── Language mapping for syntax highlighter ──────────────────────────────────

function getSyntaxLanguage(language: string): string {
  const map: Record<string, string> = {
    python: "python",
    javascript: "javascript",
    typescript: "typescript",
    jsx: "jsx",
    tsx: "tsx",
    json: "json",
    yaml: "yaml",
    markdown: "markdown",
    html: "html",
    css: "css",
    scss: "scss",
    sql: "sql",
    bash: "bash",
    dockerfile: "docker",
    toml: "toml",
    text: "text",
    rust: "rust",
    go: "go",
    java: "java",
    ruby: "ruby",
    php: "php",
    c: "c",
    cpp: "cpp",
    makefile: "makefile",
  };
  return map[language] || "text";
}

// ─── File header bar ──────────────────────────────────────────────────────────

function FileHeader({ file }: { file: CodeFile }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <FileCode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium truncate text-foreground">
          {file.path}
        </span>
        {file.status === "writing" && (
          <div className="flex items-center gap-1 text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-[10px] font-medium">Writing...</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] text-muted-foreground mr-2">
          {file.lines} lines · {formatBytes(file.size)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3 text-muted-foreground" />
          )}
        </Button>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── CodeViewer component ─────────────────────────────────────────────────────

interface CodeViewerProps {
  className?: string;
}

export function CodeViewer({ className }: CodeViewerProps) {
  const file = useSelectedFile();

  // Custom syntax highlighter style overrides
  const customStyle = useMemo(
    () => ({
      ...oneDark,
      'pre[class*="language-"]': {
        ...oneDark['pre[class*="language-"]'],
        margin: 0,
        borderRadius: 0,
        fontSize: "13px",
        lineHeight: "1.6",
        background: "transparent",
      },
      'code[class*="language-"]': {
        ...oneDark['code[class*="language-"]'],
        fontSize: "13px",
        lineHeight: "1.6",
        background: "transparent",
      },
    }),
    []
  );

  if (!file) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full p-6", className)}>
        <FileX className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground text-center">
          Select a file to view its code
        </p>
        <p className="text-xs text-muted-foreground/60 text-center mt-1">
          Click on any file in the tree to see the code here
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      <FileHeader file={file} />
      <div className="flex-1 overflow-auto bg-[#1e1e1e]">
        <SyntaxHighlighter
          language={getSyntaxLanguage(file.language)}
          style={customStyle}
          showLineNumbers
          lineNumberStyle={{
            minWidth: "3em",
            paddingRight: "1em",
            color: "#5a5a5a",
            fontSize: "12px",
            userSelect: "none",
          }}
          wrapLongLines={false}
          customStyle={{
            margin: 0,
            padding: "12px 0",
            background: "transparent",
            minHeight: "100%",
          }}
        >
          {file.content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
