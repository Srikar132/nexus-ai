"use client";

import { PlanPayload, useRightSidebarActions } from "@/store/right-sidebar-store";
import type { Plan, UserAction } from "@/types/workflow";
import { 
  X, 
  Code, 
  Database, 
  Globe, 
  Layers,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Pencil,
  Check,
  XCircle,
  ThumbsUp,
  RotateCcw,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { useState, useCallback } from "react";

interface ArtifactRightPreviewProps {
  payload: PlanPayload;
  onClose: () => void;
  projectId: string;
  sendAction: (action: UserAction) => void;
}

export function ArtifactRightPreview({ payload, onClose, projectId, sendAction }: ArtifactRightPreviewProps) {
  const { updatePayload } = useRightSidebarActions();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    techStack: true,
    architecture: true,
    endpoints: false,
    database: false,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editedPlan, setEditedPlan] = useState<Plan | null>(null);
  const [copied, setCopied] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // ----- Copy plan as JSON -----
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy plan");
    }
  }, [payload]);

  // ----- Download plan as JSON -----
  const handleDownload = useCallback(() => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "project-plan.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [payload]);

  // ----- Enter edit mode -----
  const handleStartEdit = useCallback(() => {
    setEditedPlan(structuredClone(payload));
    setIsEditing(true);
  }, [payload]);

  // ----- Cancel edit -----
  const handleCancelEdit = useCallback(() => {
    setEditedPlan(null);
    setIsEditing(false);
  }, []);

  // ----- Save edit → send to backend -----
  const handleSaveEdit = useCallback(() => {
    if (!editedPlan) return;
    // Update the sidebar store so UI reflects immediately
    updatePayload(() => editedPlan);
    // Send to backend via edit_plan action
    sendAction({ action: "edit_plan", edited_plan: editedPlan });
    setIsEditing(false);
    setEditedPlan(null);
  }, [editedPlan, updatePayload, sendAction]);

  // ----- Approve plan → moves to building stage -----
  const handleApprove = useCallback(() => {
    setIsApproved(true);
    sendAction({ action: "approve_plan" });
  }, [sendAction]);

  // ----- Request changes → enter edit mode -----
  const handleRequestChanges = useCallback(() => {
    handleStartEdit();
  }, [handleStartEdit]);

  // Helper to update nested field in editedPlan
  const updateField = useCallback(
    <K extends keyof Plan>(key: K, value: Plan[K]) => {
      setEditedPlan(prev => prev ? { ...prev, [key]: value } : prev);
    },
    []
  );

  // The plan to display — editedPlan while editing, payload otherwise
  const plan = isEditing && editedPlan ? editedPlan : payload;

  return (
    <div className="flex flex-col h-full">
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between p-4 bg-muted/30 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-lg">Project Plan</h2>
            <p className="text-sm text-muted-foreground truncate">
              {payload.overview || "Development Plan"}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {isEditing ? (
            <>
              <Button variant="ghost" size="icon" onClick={handleSaveEdit} className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-500/10" title="Save edits">
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleCancelEdit} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10" title="Cancel editing">
                <XCircle className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon" onClick={handleStartEdit} className="h-8 w-8" title="Edit plan">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleCopy} className="h-8 w-8" title="Copy plan">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleDownload} className="h-8 w-8" title="Download plan">
                <Download className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8" title="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ===== Content ===== */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 space-y-6">

          {/* ── Overview (editable) ── */}
          {isEditing && editedPlan ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Overview</label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-20 resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                value={editedPlan.overview}
                onChange={(e) => updateField("overview", e.target.value)}
              />
            </div>
          ) : null}

          {/* ── Tech Stack Section ── */}
          {plan.tech_stack && (
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
                      {(["language", "framework", "database"] as const).map((field) => (
                        <div key={field} className="flex items-center justify-between py-2">
                          <span className="text-sm font-medium text-muted-foreground capitalize">{field}</span>
                          {isEditing && editedPlan ? (
                            <input
                              className="max-w-45 rounded-md border bg-background px-2 py-1 text-xs font-mono text-right focus:outline-none focus:ring-2 focus:ring-ring"
                              value={editedPlan.tech_stack[field]}
                              onChange={(e) =>
                                updateField("tech_stack", {
                                  ...editedPlan.tech_stack,
                                  [field]: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <Badge variant="secondary" className="font-mono text-xs">
                              {plan.tech_stack[field]}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />
            </>
          )}

          {/* ── Architecture Section ── */}
          {plan.architecture && (
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
                    {plan.architecture.diagram && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 text-muted-foreground">Diagram</h4>
                        {isEditing && editedPlan ? (
                          <textarea
                            className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono min-h-30 resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                            value={editedPlan.architecture.diagram}
                            onChange={(e) =>
                              updateField("architecture", {
                                ...editedPlan.architecture,
                                diagram: e.target.value,
                              })
                            }
                          />
                        ) : (
                          <div className="bg-muted/50 rounded-lg p-3">
                            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                              {plan.architecture.diagram}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                    {(plan.architecture.content || isEditing) && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 text-muted-foreground">Description</h4>
                        {isEditing && editedPlan ? (
                          <textarea
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-20 resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                            value={editedPlan.architecture.content}
                            onChange={(e) =>
                              updateField("architecture", {
                                ...editedPlan.architecture,
                                content: e.target.value,
                              })
                            }
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {plan.architecture.content}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />
            </>
          )}

          {/* ── API Endpoints Section ── */}
          {plan.endpoints && plan.endpoints.length > 0 && (
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
                      {plan.endpoints.length}
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
                    {plan.endpoints.map((endpoint, index) => (
                      <div key={index} className="border rounded-lg p-3 bg-muted/20">
                        {isEditing && editedPlan ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <select
                                className="rounded-md border bg-background px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                                value={editedPlan.endpoints[index].method}
                                onChange={(e) => {
                                  const updated = [...editedPlan.endpoints];
                                  updated[index] = { ...updated[index], method: e.target.value };
                                  updateField("endpoints", updated);
                                }}
                              >
                                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                              <input
                                className="flex-1 rounded-md border bg-background px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                                value={editedPlan.endpoints[index].path}
                                onChange={(e) => {
                                  const updated = [...editedPlan.endpoints];
                                  updated[index] = { ...updated[index], path: e.target.value };
                                  updateField("endpoints", updated);
                                }}
                              />
                            </div>
                            <input
                              className="w-full rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                              placeholder="Description"
                              value={editedPlan.endpoints[index].description}
                              onChange={(e) => {
                                const updated = [...editedPlan.endpoints];
                                updated[index] = { ...updated[index], description: e.target.value };
                                updateField("endpoints", updated);
                              }}
                            />
                          </div>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />
            </>
          )}

          {/* ── Database Schema Section ── */}
          {plan.database_schemas && Object.keys(plan.database_schemas).length > 0 && (
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
                      {Object.keys(plan.database_schemas).length} tables
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
                    {Object.entries(plan.database_schemas).map(([tableName, fields]) => (
                      <div key={tableName} className="border rounded-lg p-3 bg-muted/20">
                        <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                          <Database className="h-3 w-3" />
                          {tableName}
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(fields).map(([fieldName, fieldType]) => (
                            <div key={fieldName} className="flex items-center justify-between py-1">
                              {isEditing && editedPlan ? (
                                <>
                                  <code className="text-xs font-mono text-muted-foreground">
                                    {fieldName}
                                  </code>
                                  <input
                                    className="max-w-30 rounded-md border bg-background px-2 py-0.5 text-xs font-mono text-right focus:outline-none focus:ring-2 focus:ring-ring"
                                    value={(editedPlan.database_schemas[tableName] || {})[fieldName] || fieldType}
                                    onChange={(e) => {
                                      const updatedSchemas = { ...editedPlan.database_schemas };
                                      updatedSchemas[tableName] = {
                                        ...updatedSchemas[tableName],
                                        [fieldName]: e.target.value,
                                      };
                                      updateField("database_schemas", updatedSchemas);
                                    }}
                                  />
                                </>
                              ) : (
                                <>
                                  <code className="text-xs font-mono text-muted-foreground">
                                    {fieldName}
                                  </code>
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {fieldType}
                                  </Badge>
                                </>
                              )}
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

      {/* ===== Sticky Footer — Approve / Request Changes ===== */}
      <div className="shrink-0 border-t bg-muted/30 p-4">
        {isApproved ? (
          <div className="flex items-center justify-center gap-2 text-green-600 py-2">
            <Check className="h-5 w-5" />
            <span className="font-medium text-sm">Plan Approved — Building in progress...</span>
          </div>
        ) : isEditing ? (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCancelEdit}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={handleSaveEdit}
            >
              <Check className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleRequestChanges}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Request Changes
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleApprove}
            >
              <ThumbsUp className="h-4 w-4 mr-2" />
              Approve Plan
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
