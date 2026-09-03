"use client";

/**
 * store/code-store.ts
 *
 * Zustand store managing the state of the coding agent's file tree and code viewer.
 *
 * Receives file_created / file_deleted events forwarded from workflow-store.
 * Tracks:
 *  - All files created by the agent (path → content + metadata)
 *  - Which file is currently selected (for the code viewer)
 *  - Which files are currently being written (streaming indicator)
 *  - A tree structure compatible with react-arborist
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CodeFile {
  path: string;         // e.g. "src/main.py"
  content: string;      // Full file content
  language: string;     // Detected language for syntax highlighting
  lines: number;
  size: number;
  status: "writing" | "complete";  // "writing" while agent is still working on it
  createdAt: number;    // Timestamp for ordering animations
}

/** react-arborist compatible tree node */
export interface TreeNode {
  id: string;
  name: string;
  children?: TreeNode[];
  isLeaf?: boolean;
  // extra metadata
  filePath?: string;
  language?: string;
  status?: "writing" | "complete";
}

interface CodeStore {
  // ── File data ──
  files: Map<string, CodeFile>;
  
  // ── UI state ──
  selectedFile: string | null;  // Currently selected file path
  isActive: boolean;            // Whether the coding agent is active (building/fixing)
  
  // ── Actions ──
  addFile: (path: string, content: string, lines: number, size: number) => void;
  updateFileContent: (path: string, content: string) => void;
  markFileComplete: (path: string) => void;
  deleteFile: (path: string) => void;
  selectFile: (path: string | null) => void;
  setActive: (active: boolean) => void;
  reset: () => void;
  
  // ── Computed ──
  getFile: (path: string) => CodeFile | undefined;
  getFileList: () => CodeFile[];
  getTreeData: () => TreeNode[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Detect language from file extension */
function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    py: "python",
    js: "javascript",
    ts: "typescript",
    jsx: "jsx",
    tsx: "tsx",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    html: "html",
    css: "css",
    scss: "scss",
    sql: "sql",
    sh: "bash",
    bash: "bash",
    dockerfile: "dockerfile",
    toml: "toml",
    ini: "ini",
    cfg: "ini",
    txt: "text",
    env: "bash",
    gitignore: "text",
    rs: "rust",
    go: "go",
    java: "java",
    rb: "ruby",
    php: "php",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
  };
  // Handle special filenames
  const filename = path.split("/").pop()?.toLowerCase() || "";
  if (filename === "dockerfile") return "dockerfile";
  if (filename === ".gitignore") return "text";
  if (filename === "makefile") return "makefile";
  if (filename === "requirements.txt") return "text";
  
  return langMap[ext] || "text";
}

/** Build a tree structure from flat file paths */
function buildTree(files: Map<string, CodeFile>): TreeNode[] {
  const root: TreeNode = { id: "root", name: "workspace", children: [] };
  
  // Sort files by path for consistent ordering
  const sortedPaths = Array.from(files.keys()).sort();
  
  for (const filePath of sortedPaths) {
    const file = files.get(filePath)!;
    const parts = filePath.split("/");
    let current = root;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const id = parts.slice(0, i + 1).join("/");
      
      if (isFile) {
        // Add file node
        if (!current.children) current.children = [];
        const existing = current.children.find((c) => c.id === id);
        if (!existing) {
          current.children.push({
            id,
            name: part,
            isLeaf: true,
            filePath: filePath,
            language: file.language,
            status: file.status,
          });
        } else {
          // Update existing node metadata
          existing.status = file.status;
          existing.language = file.language;
        }
      } else {
        // Add/find directory node
        if (!current.children) current.children = [];
        let dir = current.children.find((c) => c.id === id && !c.isLeaf);
        if (!dir) {
          dir = { id, name: part, children: [] };
          current.children.push(dir);
        }
        current = dir;
      }
    }
  }
  
  // Sort children: directories first, then files, alphabetical within each
  function sortChildren(node: TreeNode) {
    if (!node.children) return;
    node.children.sort((a, b) => {
      const aIsDir = !a.isLeaf;
      const bIsDir = !b.isLeaf;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortChildren);
  }
  sortChildren(root);
  
  return root.children || [];
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCodeStore = create<CodeStore>()(
  devtools(
    (set, get) => ({
      files: new Map(),
      selectedFile: null,
      isActive: false,
      
      addFile: (path, content, lines, size) => {
        set((state) => {
          const newFiles = new Map(state.files);
          newFiles.set(path, {
            path,
            content,
            language: detectLanguage(path),
            lines,
            size,
            status: "complete",
            createdAt: Date.now(),
          });
          // Auto-select the first file, or the newly created file
          const selectedFile = state.selectedFile || path;
          return { files: newFiles, selectedFile };
        }, false, "addFile");
      },
      
      updateFileContent: (path, content) => {
        set((state) => {
          const newFiles = new Map(state.files);
          const existing = newFiles.get(path);
          if (existing) {
            newFiles.set(path, {
              ...existing,
              content,
              lines: content.split("\n").length,
              size: new Blob([content]).size,
            });
          }
          return { files: newFiles };
        }, false, "updateFileContent");
      },
      
      markFileComplete: (path) => {
        set((state) => {
          const newFiles = new Map(state.files);
          const existing = newFiles.get(path);
          if (existing) {
            newFiles.set(path, { ...existing, status: "complete" });
          }
          return { files: newFiles };
        }, false, "markFileComplete");
      },
      
      deleteFile: (path) => {
        set((state) => {
          const newFiles = new Map(state.files);
          newFiles.delete(path);
          // If deleted file was selected, clear selection or select another
          const selectedFile = state.selectedFile === path
            ? (newFiles.size > 0 ? Array.from(newFiles.keys())[0] : null)
            : state.selectedFile;
          return { files: newFiles, selectedFile };
        }, false, "deleteFile");
      },
      
      selectFile: (path) => {
        set({ selectedFile: path }, false, "selectFile");
      },
      
      setActive: (active) => {
        set({ isActive: active }, false, "setActive");
      },
      
      reset: () => {
        set({
          files: new Map(),
          selectedFile: null,
          isActive: false,
        }, false, "reset");
      },
      
      getFile: (path) => get().files.get(path),
      
      getFileList: () => Array.from(get().files.values()).sort(
        (a, b) => a.createdAt - b.createdAt
      ),
      
      getTreeData: () => buildTree(get().files),
    }),
    { name: "code-store" }
  )
);

// ─── Selector hooks ───────────────────────────────────────────────────────────

export const useSelectedFile = () => {
  const selectedFile = useCodeStore((s) => s.selectedFile);
  const files = useCodeStore((s) => s.files);
  if (!selectedFile) return null;
  return files.get(selectedFile) || null;
};

export const useFileCount = () => useCodeStore((s) => s.files.size);
export const useIsCodeActive = () => useCodeStore((s) => s.isActive);
