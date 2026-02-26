"use client";

import { PlanPayload, useRightSidebar } from "@/store/right-sidebar-store";
import { ArtifactRightPreview } from "./artifact-right-preview";
import { CodePanel } from "./code-panel";
import type { UserAction } from "@/types/workflow";

interface RightSidebarProps {
  projectId: string;
  sendAction: (action: UserAction) => void;
}

export const RightSidebar = ({ projectId, sendAction }: RightSidebarProps) => {
  const { currentState, payload, hide } = useRightSidebar();

  const renderContent = () => {
    switch (currentState) {
      case "plan":
        
        return (
          <ArtifactRightPreview 
            payload={payload as PlanPayload} 
            onClose={hide}
            projectId={projectId}
            sendAction={sendAction}
          />
        );

      case "code":
        return (
          <CodePanel onClose={hide} />
        );

      case "idle":
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="text-muted-foreground">
              <h3 className="font-medium mb-2">Nothing to show</h3>
              <p className="text-sm">Select an item to view details here.</p>
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
