"use client";

/**
 * workspace-client.tsx
 *
 * Passes inProgressMessage directly to WorkspaceChat instead of
 * the old flat streaming_text + active_role pair.
 */

import { Project } from "@/types/project";
import { WorkspaceHeader } from "./workspace-header";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../ui/resizable";
import WorkspaceChat from "./workspace-chat";
import { useWorkflow } from "@/hooks/use-workflow";
import { useRightSidebar } from "@/store/right-sidebar-store";
import RightSidebar from "./right-sidebar";

interface WorkspaceClientProps {
  initialProject: Project;
}

const WorkspaceClient = ({ initialProject }: WorkspaceClientProps) => {
  const {
    messages,
    stage,
    active_plan,
    inProgressMessage,
    active_role,
    is_streaming,
    error,
    isLoadingHistory,
    isHistoryError,
    isSending,
    sendAction,
  } = useWorkflow(initialProject.id);


  return (
    <>
      <WorkspaceHeader
        projectName={initialProject.name}
        isBuilding={["building", "planning", "testing", "fixing"].includes(stage)}
        activeTab="code"
        onTabChange={() => {}}
        onDeploy={() => console.log("Deploy")}
        onShare={() => console.log("Share")}
      />

      <div style={{ height: "calc(100vh - 56px)" }}>
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          {/* Main Content - Chat */}
          <ResizablePanel minSize={500} maxSize={800}>
            <WorkspaceChat
              projectId={initialProject.id}
              messages={messages}
              stage={stage}
              active_plan={active_plan}
              inProgressMessage={inProgressMessage}
              active_role={active_role}
              is_streaming={is_streaming}
              error={error}
              isLoadingHistory={isLoadingHistory}
              isHistoryError={isHistoryError}
              isSending={isSending}
              sendAction={sendAction}
            />
          </ResizablePanel>

          {/* Right Sidebar - conditionally rendered with resizable handle */}
          <ResizableHandle />
          <ResizablePanel className="w-full">
            <RightSidebar />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  );
};

export default WorkspaceClient;