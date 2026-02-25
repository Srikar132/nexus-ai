"use client";

import { useState } from "react";
import {
    CheckCircle2,
    Circle,
    Loader2,
    ChevronRight,
    ChevronDown,
    Bot,
    Code2,
    Shield,
    Rocket,
    Activity,
    FileCode,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Task status types
export type TaskStatus = "done" | "working" | "next" | "pending";

// Task interface
export interface Task {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    squad?: "spectracode" | "threatnest" | "opsorchestra" | "observeiq";
    agent?: string;
    progress?: number;
    icon?: React.ReactNode;
}

// Squad metadata
const squads = {
    spectracode: {
        name: "SpectraCode",
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/30",
        icon: Code2,
    },
    threatnest: {
        name: "ThreatNest",
        color: "text-red-500",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/30",
        icon: Shield,
    },
    opsorchestra: {
        name: "OpsOrchestra",
        color: "text-green-500",
        bgColor: "bg-green-500/10",
        borderColor: "border-green-500/30",
        icon: Rocket,
    },
    observeiq: {
        name: "ObserveIQ",
        color: "text-purple-500",
        bgColor: "bg-purple-500/10",
        borderColor: "border-purple-500/30",
        icon: Activity,
    },
};

// Task status indicators
function TaskStatusIcon({ status }: { status: TaskStatus }) {
    switch (status) {
        case "done":
            return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
        case "working":
            return (
                <div className="relative">
                    <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                </div>
            );
        case "next":
        case "pending":
        default:
            return <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0" />;
    }
}

// Task item component
function TaskItem({ task }: { task: Task }) {
    const squad = task.squad ? squads[task.squad] : null;
    const SquadIcon = squad?.icon;

    return (
        <div
            className={cn(
                "group flex items-start gap-3 p-3 rounded-lg transition-colors",
                task.status === "working" && "bg-primary/5 border border-primary/20",
                task.status === "done" && "opacity-70",
                task.status !== "working" && "hover:bg-muted/50"
            )}
        >
            <TaskStatusIcon status={task.status} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            "text-sm font-medium",
                            task.status === "done" && "line-through text-muted-foreground"
                        )}
                    >
                        {task.title}
                    </span>
                    {squad && SquadIcon && (
                        <span className={cn("inline-flex p-0.5 rounded", squad.bgColor)}>
                            <SquadIcon className={cn("h-3 w-3", squad.color)} />
                        </span>
                    )}
                </div>
                {task.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {task.description}
                    </p>
                )}
                {task.agent && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground/70">
                        <Bot className="h-3 w-3" />
                        <span>{task.agent}</span>
                    </div>
                )}
                {task.status === "working" && task.progress !== undefined && (
                    <Progress value={task.progress} className="h-1 mt-2" />
                )}
            </div>
        </div>
    );
}

// Task section component
function TaskSection({
    title,
    tasks,
    defaultOpen = true,
}: {
    title: string;
    tasks: Task[];
    defaultOpen?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    if (tasks.length === 0) return null;

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                )}
                {title}
                <span className="ml-auto text-[10px] font-normal bg-muted px-1.5 py-0.5 rounded">
                    {tasks.length}
                </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 px-1">
                {tasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                ))}
            </CollapsibleContent>
        </Collapsible>
    );
}

interface TaskPanelProps {
    tasks?: Task[];
    currentFile?: string;
    currentAction?: string;
    className?: string;
}

// Sample tasks for demo
const sampleTasks: Task[] = [
    {
        id: "1",
        title: "Generate hero and product images",
        status: "done",
        squad: "spectracode",
        agent: "Coder Agent",
    },
    {
        id: "2",
        title: "Set up design system",
        description: "Setting up design system components in parallel",
        status: "working",
        squad: "spectracode",
        agent: "Planner Agent",
        progress: 65,
    },
    {
        id: "3",
        title: "Build all page components",
        status: "next",
        squad: "spectracode",
        agent: "Coder Agent",
    },
    {
        id: "4",
        title: "Run security audit",
        status: "pending",
        squad: "threatnest",
        agent: "Red Team Agent",
    },
    {
        id: "5",
        title: "Set up CI/CD pipeline",
        status: "pending",
        squad: "opsorchestra",
        agent: "Pipeline Agent",
    },
    {
        id: "6",
        title: "Configure monitoring",
        status: "pending",
        squad: "observeiq",
        agent: "Log Analysis Agent",
    },
];

export function TaskPanel({
    tasks = sampleTasks,
    currentFile,
    currentAction,
    className,
}: TaskPanelProps) {
    const doneTasks = tasks.filter((t) => t.status === "done");
    const workingTasks = tasks.filter((t) => t.status === "working");
    const nextTasks = tasks.filter(
        (t) => t.status === "next" || t.status === "pending"
    );

    const totalTasks = tasks.length;
    const completedTasks = doneTasks.length;
    const overallProgress =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return (
        <div className={cn("flex flex-col h-full bg-card/30", className)}>
            {/* Current action header */}
            {(currentFile || currentAction) && (
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileCode className="h-3.5 w-3.5" />
                        <span className="font-medium">Editing</span>
                        <span className="text-foreground truncate font-mono">
                            {currentFile || "tailwind.config.ts"}
                        </span>
                    </div>
                    {currentAction && (
                        <p className="text-sm mt-1.5 text-foreground">
                            {currentAction || "Setting up design system components in parallel"}
                        </p>
                    )}
                </div>
            )}

            {/* Overall progress */}
            <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                        Overall Progress
                    </span>
                    <span className="text-xs font-semibold">{overallProgress}%</span>
                </div>
                <Progress value={overallProgress} className="h-1.5" />
            </div>

            {/* Task list */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-4">
                    <TaskSection title="Done" tasks={doneTasks} />
                    <TaskSection title="Working" tasks={workingTasks} />
                    <TaskSection title="Next" tasks={nextTasks} />
                </div>
            </ScrollArea>
        </div>
    );
}
