"use client";

/**
 * workspace-client.tsx
 *
 * Passes inProgressMessage directly to WorkspaceChat instead of
 * the old flat streaming_text + active_role pair.
 * 
 * Tab switching: "code" tab toggles the code panel in the right sidebar.
 */

import { useCallback } from "react";
import { Project } from "@/types/project";
import { WorkspaceHeader } from "./workspace-header";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../ui/resizable";
import WorkspaceChat from "./workspace-chat";
import { useWorkflow } from "@/hooks/use-workflow";
import RightSidebar from "./right-sidebar";
import { useRightSidebar } from "@/store/right-sidebar-store";

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
    isThinking,
    thinkingStatus,
    error,
    isLoadingHistory,
    isHistoryError,
    isSending,
    sendAction,
  } = useWorkflow(initialProject.id);

  const { currentState, showCode, setIdle } = useRightSidebar();

  const handleTabChange = useCallback(
    (tab: string) => {
      if (tab === "code") {
        // Toggle: if already showing code, go to idle; otherwise show code
        if (currentState === "code") {
          setIdle();
        } else {
          showCode();
        }
      }
      // "agents" and "activity" tabs — future implementation
    },
    [currentState, showCode, setIdle]
  );

  return (
    <>
      <WorkspaceHeader
        projectName={initialProject.name}
        isBuilding={["building", "planning", "testing", "fixing"].includes(stage)}
        activeTab={currentState === "code" ? "code" : undefined}
        onTabChange={handleTabChange}
        onDeploy={() => console.log("Deploy")}
        onShare={() => console.log("Share")}
      />

      <div style={{ height: "calc(100vh - 56px)" }}>
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          {/* Main Content - Chat */}
          <ResizablePanel defaultSize={60} minSize={40} maxSize={75}>
            <WorkspaceChat
              projectId={initialProject.id}
              messages={messages}
              stage={stage}
              active_plan={active_plan}
              inProgressMessage={inProgressMessage}
              active_role={active_role}
              is_streaming={is_streaming}
              isThinking={isThinking}
              thinkingStatus={thinkingStatus}
              error={error}
              isLoadingHistory={isLoadingHistory}
              isHistoryError={isHistoryError}
              isSending={isSending}
              sendAction={sendAction}
            />
          </ResizablePanel>

          {/* Right Sidebar - conditionally rendered with resizable handle */}
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40} minSize={25} maxSize={60}>
            <RightSidebar projectId={initialProject.id} sendAction={sendAction} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  );
};

export default WorkspaceClient;