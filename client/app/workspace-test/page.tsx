"use client";

import { Group, Panel, Separator } from "react-resizable-panels";

export default function WorkspaceTestPage() {
    return (
        <div className="h-screen w-screen bg-background">
            <Group orientation="horizontal" className="h-full">
                <Panel defaultSize={20} minSize={10}>
                    <div className="h-full w-full bg-red-500/20 p-4">
                        <h2 className="text-lg font-bold">Left Panel</h2>
                        <p>This is the left panel content. It should be resizable.</p>
                    </div>
                </Panel>

                <Separator className="w-2 bg-border" />

                <Panel defaultSize={50} minSize={20}>
                    <div className="h-full w-full bg-green-500/20 p-4">
                        <h2 className="text-lg font-bold">Center Panel</h2>
                        <p>This is the center panel content. It should be resizable.</p>
                    </div>
                </Panel>

                <Separator className="w-2 bg-border" />

                <Panel defaultSize={30} minSize={10}>
                    <div className="h-full w-full bg-blue-500/20 p-4">
                        <h2 className="text-lg font-bold">Right Panel</h2>
                        <p>This is the right panel content. It should be resizable.</p>
                    </div>
                </Panel>
            </Group>
        </div>
    );
}
