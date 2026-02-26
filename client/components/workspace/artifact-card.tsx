"use client";

import { useRightSidebar } from "@/store/right-sidebar-store";
import React, { useState } from "react";
import type { Plan } from "@/types/workflow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileCode, 
  ChevronDown, 
  ChevronUp,
  Database,
  Layers,
  Cpu
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ArtifactCardProps {
  artifactType: string;
  title: string;
  content: unknown;
}

export function ArtifactCard({ artifactType, title, content }: ArtifactCardProps) {

  if (artifactType === "plan") {
    return <PlanArtifact plan={content as Plan} title={title} />;
  }

  // Generic artifact display
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="size-4 text-primary" />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {artifactType}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
          {JSON.stringify(content, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

function PlanArtifact({ plan, title }: { plan: Plan; title: string }) {
  const { showPlan } = useRightSidebar();

  const handleClick = () => {
    showPlan(plan);
  };

  return (
    <Card className="border-primary/20 bg-secondary cursor-pointer hover:bg-secondary/80 transition-colors" onClick={handleClick}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
          </div>
          <Badge variant="outline" className="bg-primary text-primary-foreground hover:bg-primary/90">
            View Plan
          </Badge>
        </div>
      </CardHeader>
    </Card>
  );
}
