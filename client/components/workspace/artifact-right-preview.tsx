"use client";

import { PlanPayload } from "@/store/right-sidebar-store";
import { 
  X, 
  FileText, 
  Code, 
  Database, 
  Globe, 
  Layers,
  Settings,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { useState } from "react";

interface ArtifactRightPreviewProps {
  payload: PlanPayload;
  onClose: () => void;
}

export function ArtifactRightPreview({ payload, onClose }: ArtifactRightPreviewProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    techStack: true,
    architecture: true,
    endpoints: false,
    database: false,
  });


  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 b bg-muted/30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Project Plan</h2>
            <p className="text-sm text-muted-foreground">{payload.overview || "Development Plan"}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 space-y-6">
          {/* Tech Stack Section */}
          {payload.tech_stack && (
            <>
              <Collapsible
                open={expandedSections.techStack}
                onOpenChange={() => toggleSection('techStack')}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-0 hover:no-underline group">
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium text-left">Technology Stack</h3>
                  </div>
                  {expandedSections.techStack ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="pl-6 space-y-4">
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm font-medium text-muted-foreground">Language</span>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {payload.tech_stack.language}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm font-medium text-muted-foreground">Framework</span>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {payload.tech_stack.framework}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm font-medium text-muted-foreground">Database</span>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {payload.tech_stack.database}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />
            </>
          )}

          {/* Architecture Section */}
          {payload.architecture && (
            <>
              <Collapsible
                open={expandedSections.architecture}
                onOpenChange={() => toggleSection('architecture')}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-0 hover:no-underline group">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium text-left">Architecture</h3>
                  </div>
                  {expandedSections.architecture ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="pl-6 space-y-4">
                    {payload.architecture.diagram && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 text-muted-foreground">Diagram</h4>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                            {payload.architecture.diagram}
                          </pre>
                        </div>
                      </div>
                    )}
                    {payload.architecture.content && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 text-muted-foreground">Description</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {payload.architecture.content}
                        </p>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />
            </>
          )}

          {/* API Endpoints Section */}
          {payload.endpoints && payload.endpoints.length > 0 && (
            <>
              <Collapsible
                open={expandedSections.endpoints}
                onOpenChange={() => toggleSection('endpoints')}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-0 hover:no-underline group">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium text-left">API Endpoints</h3>
                    <Badge variant="outline" className="text-xs">
                      {payload.endpoints.length}
                    </Badge>
                  </div>
                  {expandedSections.endpoints ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="pl-6 space-y-3">
                    {payload.endpoints.map((endpoint, index) => (
                      <div key={index} className="border rounded-lg p-3 bg-muted/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge 
                            variant={
                              endpoint.method === 'GET' ? 'default' :
                              endpoint.method === 'POST' ? 'secondary' :
                              endpoint.method === 'PUT' ? 'outline' :
                              endpoint.method === 'DELETE' ? 'destructive' :
                              'default'
                            }
                            className="text-xs font-mono"
                          >
                            {endpoint.method}
                          </Badge>
                          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                            {endpoint.path}
                          </code>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {endpoint.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />
            </>
          )}

          {/* Database Schema Section */}
          {payload.database_schemas && Object.keys(payload.database_schemas).length > 0 && (
            <>
              <Collapsible
                open={expandedSections.database}
                onOpenChange={() => toggleSection('database')}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-0 hover:no-underline group">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium text-left">Database Schema</h3>
                    <Badge variant="outline" className="text-xs">
                      {Object.keys(payload.database_schemas).length} tables
                    </Badge>
                  </div>
                  {expandedSections.database ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="pl-6 space-y-4">
                    {Object.entries(payload.database_schemas).map(([tableName, fields]) => (
                      <div key={tableName} className="border rounded-lg p-3 bg-muted/20">
                        <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                          <Database className="h-3 w-3" />
                          {tableName}
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(fields).map(([fieldName, fieldType]) => (
                            <div key={fieldName} className="flex items-center justify-between py-1">
                              <code className="text-xs font-mono text-muted-foreground">
                                {fieldName}
                              </code>
                              <Badge variant="outline" className="text-xs font-mono">
                                {fieldType}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
