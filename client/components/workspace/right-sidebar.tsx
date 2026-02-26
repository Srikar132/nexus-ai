"use client";

import { PlanPayload, useRightSidebar } from "@/store/right-sidebar-store";
import { useWorkflowStore } from "@/store/workflow-store";
import { ArtifactRightPreview } from "./artifact-right-preview";

export const RightSidebar = () => {
  const { currentState, payload, hide } = useRightSidebar();

  const renderContent = () => {
    switch (currentState) {
      case "plan":
        
        return (
          <ArtifactRightPreview 
            payload={payload as PlanPayload} 
            onClose={hide}
          />
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
