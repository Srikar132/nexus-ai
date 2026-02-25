"use client";

import {
    Code2,
    Rocket,
    Share2,
    Settings,
    ChevronDown,
    Sparkles,
    GitBranch,
    Shield,
    Activity,
    Bot,
    Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
interface WorkspaceHeaderProps {
    projectName?: string;
    isBuilding?: boolean;
    activeTab?: string;
    onTabChange?: (tab: string) => void;
    onDeploy?: () => void;
    onShare?: () => void;
}

export function WorkspaceHeader({
    projectName = "Untitled Project",
    isBuilding = false,
    activeTab = "preview",
    onTabChange,
    onDeploy,
    onShare,
}: WorkspaceHeaderProps) {
    return (
        <header className="flex items-center justify-between h-14 px-4 border-b border-border bg-card/50 backdrop-blur-sm">
            {/* Left section - Project info */}
            <div className="flex items-center gap-3">
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                        <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-bold text-lg tracking-tight hidden sm:block">
                        Nexus<span className="text-primary">Forge</span>
                    </span>
                </div>

                <div className="h-6 w-px bg-border hidden sm:block" />

                {/* Project name dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2 font-medium max-w-[200px]"
                        >
                            <span className="truncate">{projectName}</span>
                            <ChevronDown className="h-4 w-4 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuItem>
                            <Settings className="h-4 w-4 mr-2" />
                            Project Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <GitBranch className="h-4 w-4 mr-2" />
                            View Repository
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Switch Project</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Build status badge */}
                {isBuilding && (
                    <Badge variant="secondary" className="gap-1.5 animate-pulse">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                        </span>
                        Building...
                    </Badge>
                )}
            </div>

            {/* Center section - View tabs */}
            <div className="hidden md:flex">
                <Tabs value={activeTab} onValueChange={onTabChange}>
                    <TabsList className="bg-muted/50 h-9">
                        <TabsTrigger value="preview" className="gap-1.5 text-xs px-3">
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                        </TabsTrigger>
                        <TabsTrigger value="code" className="gap-1.5 text-xs px-3">
                            <Code2 className="h-3.5 w-3.5" />
                            Code
                        </TabsTrigger>
                        <TabsTrigger value="agents" className="gap-1.5 text-xs px-3">
                            <Bot className="h-3.5 w-3.5" />
                            Agents
                        </TabsTrigger>
                        <TabsTrigger value="activity" className="gap-1.5 text-xs px-3">
                            <Activity className="h-3.5 w-3.5" />
                            Activity
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Right section - Actions */}
            <div className="flex items-center gap-2">
                {/* Squad selector dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2 hidden lg:flex">
                            <Shield className="h-4 w-4" />
                            Squads
                            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem className="gap-2">
                            <Code2 className="h-4 w-4 text-blue-500" />
                            <div>
                                <div className="font-medium">SpectraCode</div>
                                <div className="text-xs text-muted-foreground">Build Squad</div>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2">
                            <Shield className="h-4 w-4 text-red-500" />
                            <div>
                                <div className="font-medium">ThreatNest</div>
                                <div className="text-xs text-muted-foreground">Security Squad</div>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2">
                            <Rocket className="h-4 w-4 text-green-500" />
                            <div>
                                <div className="font-medium">OpsOrchestra</div>
                                <div className="text-xs text-muted-foreground">Deploy Squad</div>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2">
                            <Activity className="h-4 w-4 text-purple-500" />
                            <div>
                                <div className="font-medium">ObserveIQ</div>
                                <div className="text-xs text-muted-foreground">Monitor Squad</div>
                            </div>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={onShare}
                >
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Share</span>
                </Button>

                <Button
                    size="sm"
                    className="gap-2 bg-primary hover:bg-primary/90"
                    onClick={onDeploy}
                >
                    <Rocket className="h-4 w-4" />
                    <span className="hidden sm:inline">Deploy</span>
                </Button>
            </div>
        </header>
    );
}
