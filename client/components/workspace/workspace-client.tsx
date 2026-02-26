"use client";

import { Project } from "@/types/project";
import { WorkspaceHeader } from "./workspace-header";
import { init } from "next/dist/compiled/webpack/webpack";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../ui/resizable";
import WorkspaceChat from "./workspace-chat";
import { useWorkflow } from "@/hooks/use-workflow";



interface WorkspaceClientProps {
    initialProject: Project;
}

const WorkspaceClient = ({ initialProject }: WorkspaceClientProps) => {

    const {
        messages,
        stage,
        active_plan,
        streaming_text,
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
                isBuilding={stage === "building" || stage === "planning" || stage === "testing" || stage === "fixing"}
                activeTab={"code"}
                onTabChange={() => { }}
                onDeploy={() => console.log("Deploy")}
                onShare={() => console.log("Share")}
            />

            <div style={{ height: "calc(100vh - 56px)" }}>
                <ResizablePanelGroup orientation="horizontal">
                    <ResizablePanel accessKey="panel1" minSize={400} maxSize={550}>
                        <WorkspaceChat
                            projectId={initialProject.id}
                            messages={messages}
                            stage={stage}
                            active_plan={active_plan}
                            streaming_text={streaming_text}
                            active_role={active_role}
                            is_streaming={is_streaming}
                            error={error}
                            isLoadingHistory={isLoadingHistory}
                            isHistoryError={isHistoryError}
                            isSending={isSending}
                            sendAction={sendAction}
                        />
                    </ResizablePanel>
                    <ResizableHandle/>
                    <ResizablePanel accessKey="panel2">Two</ResizablePanel>
                </ResizablePanelGroup>
            </div>

        </>
    );
};


export default WorkspaceClient;