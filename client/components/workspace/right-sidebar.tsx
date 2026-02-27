"use client";

import { useRightSidebar } from "@/store/right-sidebar-store";
// import { useCodeStore } from "@/store/code-store";
import { Code2, FileCode, FolderTree } from "lucide-react";

export const RightSidebar = () => {
  const { currentState, hide } = useRightSidebar();
  // const files = useCodeStore((s) => s.files);
  // const selectedFile = useCodeStore((s) => s.selectedFile);
  // const selectFile = useCodeStore((s) => s.selectFile);

  // const fileList = Array.from(files.values());
  // const selected = selectedFile ? files.get(selectedFile) : null;

  const renderContent = () => {
    switch (currentState) {
      // case "code":
      //   if (fileList.length === 0) {
      //     return (
      //       <div className="flex flex-col items-center justify-center h-full text-center p-6">
      //         <Code2 className="size-12 text-muted-foreground/40 mb-4" />
      //         <h3 className="font-medium mb-2 text-muted-foreground">No files yet</h3>
      //         <p className="text-sm text-muted-foreground/60">
      //           Files will appear here as the coding agent creates them.
      //         </p>
      //       </div>
      //     );
      //   }

      //   return (
      //     <div className="flex flex-col h-full">
      //       {/* File list */}
      //       <div className="border-b border-border p-2 shrink-0">
      //         <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
      //           <FolderTree className="size-3.5" />
      //           Files ({fileList.length})
      //         </div>
      //         <div className="max-h-48 overflow-y-auto mt-1">
      //           {fileList.map((file) => (
      //             <button
      //               key={file.path}
      //               onClick={() => selectFile(file.path)}
      //               className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted/50 transition-colors ${
      //                 selectedFile === file.path ? "bg-muted text-foreground" : "text-muted-foreground"
      //               }`}
      //             >
      //               <FileCode className="size-3.5 shrink-0" />
      //               <span className="truncate">{file.path}</span>
      //               {file.status === "writing" && (
      //                 <span className="ml-auto size-2 rounded-full bg-yellow-500 animate-pulse" />
      //               )}
      //             </button>
      //           ))}
      //         </div>
      //       </div>

      //       {/* Code viewer */}
      //       <div className="flex-1 overflow-auto p-4">
      //         {selected ? (
      //           <div>
      //             <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
      //               <FileCode className="size-3.5" />
      //               <span className="font-mono">{selected.path}</span>
      //               <span className="ml-auto">{selected.lines} lines</span>
      //             </div>
      //             <pre className="text-xs font-mono bg-muted/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
      //               <code>{selected.content}</code>
      //             </pre>
      //           </div>
      //         ) : (
      //           <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
      //             Select a file to view its contents
      //           </div>
      //         )}
      //       </div>
      //     </div>
      //   );

      case "idle":
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <Code2 className="size-12 text-muted-foreground/40 mb-4" />
            <div className="text-muted-foreground">
              <h3 className="font-medium mb-2">Code Panel</h3>
              <p className="text-sm">Files created by the coding agent will appear here during builds.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-full">
      {renderContent()}
    </div>
  );
};

export default RightSidebar;
