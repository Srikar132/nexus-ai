"use client";

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
  const [isOpen, setIsOpen] = useState(true);

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
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Card className="border-primary/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs bg-primary/10">
            Plan
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overview */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">
            Overview
          </h4>
          <p className="text-sm leading-relaxed">{plan.overview}</p>
        </div>

        {/* Tech Stack */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between px-0 h-auto">
              <div className="flex items-center gap-2">
                <Cpu className="size-3.5" />
                <span className="text-xs font-semibold">Tech Stack</span>
              </div>
              {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Language:</span>
              <Badge variant="secondary" className="text-xs">
                {plan.tech_stack.language}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Framework:</span>
              <Badge variant="secondary" className="text-xs">
                {plan.tech_stack.framework}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Database:</span>
              <Badge variant="secondary" className="text-xs">
                {plan.tech_stack.database}
              </Badge>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Architecture */}
        {plan.architecture && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">
              Architecture
            </h4>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {plan.architecture.content}
            </p>
          </div>
        )}

        {/* Database Schemas */}
        {plan.database_schemas && Object.keys(plan.database_schemas).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Database className="size-3.5" />
              <h4 className="text-xs font-semibold text-muted-foreground">
                Database Schemas
              </h4>
            </div>
            <div className="space-y-2">
              {Object.entries(plan.database_schemas).map(([tableName, fields]) => (
                <div key={tableName} className="bg-muted/50 p-2 rounded-lg">
                  <div className="text-xs font-medium mb-1">{tableName}</div>
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    {Object.entries(fields).map(([field, type]) => (
                      <div key={field} className="flex justify-between">
                        <span>{field}</span>
                        <span className="font-mono text-[10px]">{type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* API Endpoints */}
        {plan.endpoints && plan.endpoints.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">
              API Endpoints
            </h4>
            <div className="space-y-1.5">
              {plan.endpoints.map((endpoint, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 text-xs bg-muted/50 p-2 rounded"
                >
                  <Badge
                    variant={
                      endpoint.method === "GET"
                        ? "secondary"
                        : endpoint.method === "POST"
                        ? "default"
                        : "outline"
                    }
                    className="text-[10px] shrink-0"
                  >
                    {endpoint.method}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <code className="text-xs font-mono">{endpoint.path}</code>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {endpoint.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
