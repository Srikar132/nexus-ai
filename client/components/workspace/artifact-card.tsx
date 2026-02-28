"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileCode,
  Rocket,
  Loader2,
  CheckCircle2,
  Plus,
  Trash2,
  Train,
  ExternalLink,
  KeyRound,
} from "lucide-react";
import type { UserAction } from "@/types/workflow";

/* ── Payload shape emitted by _publish_env_var_request on the server ── */
interface EnvVarRequestPayload {
  build_id: string;
  message: string;
  suggested_vars: string[];
}

/* ── Payload shape emitted by _publish_connect_railway on the server ── */
interface ConnectRailwayPayload {
  build_id: string;
  status: string;
  message: string;
}

/* ── Props ─────────────────────────────────────────────────────────── */
interface ArtifactCardProps {
  artifactType: string;
  title: string;
  content: unknown;
  /** Required for env_var_request — the active project id */
  projectId?: string;
  /** Required for env_var_request — calls sendAction with provide_env_vars */
  sendAction?: (action: UserAction) => void;
}

/* ── Helpers ───────────────────────────────────────────────────────── */
function parseEnvVarPayload(content: unknown): EnvVarRequestPayload | null {
  try {
    const raw = typeof content === "string" ? JSON.parse(content) : content;
    if (raw && typeof raw === "object" && "suggested_vars" in raw) {
      return raw as EnvVarRequestPayload;
    }
  } catch {
    /* content wasn't valid JSON — fall through */
  }
  return null;
}

function parseConnectRailwayPayload(content: unknown): ConnectRailwayPayload | null {
  try {
    const raw = typeof content === "string" ? JSON.parse(content) : content;
    if (raw && typeof raw === "object" && "status" in raw && (raw as ConnectRailwayPayload).status === "waiting_for_railway_key") {
      return raw as ConnectRailwayPayload;
    }
  } catch {
    /* content wasn't valid JSON — fall through */
  }
  return null;
}

/* ── Component ─────────────────────────────────────────────────────── */
export function ArtifactCard({
  artifactType,
  title,
  content,
  projectId,
  sendAction,
}: ArtifactCardProps) {
  /* ── env_var_request card ───────────────────────────────────────── */
  if (artifactType === "env_var_request") {
    return (
      <EnvVarRequestCard
        title={title}
        content={content}
        projectId={projectId}
        sendAction={sendAction}
      />
    );
  }

  /* ── connect_railway card ───────────────────────────────────────── */
  if (artifactType === "connect_railway") {
    return (
      <ConnectRailwayCard
        title={title}
        content={content}
        projectId={projectId}
        sendAction={sendAction}
      />
    );
  }

  /* ── generic / fallback card ────────────────────────────────────── */
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * CONNECT RAILWAY CARD
 * Shown when the user hasn't connected their Railway account yet.
 * Inline token input + Connect button.
 * Uses sendAction({ action: "provide_railway_key", railway_key }) which
 * goes through POST /messages — backend encrypts, saves, and triggers
 * railway_connect_task to resume the deployer automatically.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ConnectRailwayCard({
  title,
  content,
  projectId,
  sendAction,
}: Pick<ArtifactCardProps, "title" | "content" | "projectId" | "sendAction">) {
  const payload = useMemo(() => parseConnectRailwayPayload(content), [content]);

  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(() => {
    const trimmed = token.trim();
    if (!trimmed || !sendAction) return;

    setSubmitting(true);
    setError(null);

    try {
      sendAction({ action: "provide_railway_key", railway_key: trimmed });
      setConnected(true);
      setToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setSubmitting(false);
    }
  }, [token, sendAction]);

  /* If we couldn't parse the payload, show raw content */
  if (!payload) {
    return (
      <Card className="border-primary/20">
        <CardContent className="py-4">
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
            {JSON.stringify(content, null, 2)}
          </pre>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/30 bg-linear-to-br from-card to-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Train className="size-4 text-amber-500" />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
          </div>
          <Badge
            variant="outline"
            className="text-xs border-amber-500/30 text-amber-600 dark:text-amber-400"
          >
            Railway
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Message from the backend */}
        <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
          {payload.message}
        </p>

        {connected ? (
          /* ── Success state ─────────────────────────────────────── */
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="size-4" />
            <span>
              Railway connected! Deployment will resume automatically…
            </span>
          </div>
        ) : (
          /* ── Token input + Connect button ───────────────────────── */
          <div className="space-y-3">
            <div className="relative">
              <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                className="h-9 text-xs font-mono pl-8"
                placeholder="Paste your Railway API token…"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={submitting}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && token.trim()) handleConnect();
                }}
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex items-center gap-2">
              <Button
                className="flex-1"
                variant="default"
                onClick={handleConnect}
                disabled={submitting || !token.trim() || !sendAction}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Connecting…
                  </>
                ) : (
                  <>
                    <Train className="size-4 mr-2" />
                    Connect Railway
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() =>
                  window.open(
                    "https://railway.app/account/tokens",
                    "_blank"
                  )
                }
              >
                <ExternalLink className="size-3.5" />
                Get Token
              </Button>
            </div>

            <p className="text-xs text-muted-foreground/70">
              One-time setup — your token is encrypted server-side and used
              automatically for all future deploys.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ENV VAR REQUEST CARD
 * Shows the deploy form with suggested env-var fields + an "Add"
 * button for extras + a Deploy button.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function EnvVarRequestCard({
  title,
  content,
  projectId,
  sendAction,
}: Pick<ArtifactCardProps, "title" | "content" | "projectId" | "sendAction">) {
  const payload = useMemo(() => parseEnvVarPayload(content), [content]);

  /* Each row: { key, value } — initialised from suggested_vars */
  const [rows, setRows] = useState<{ key: string; value: string }[]>(() =>
    (payload?.suggested_vars ?? []).map((v) => ({ key: v, value: "" }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  /* Row helpers */
  const updateRow = useCallback(
    (idx: number, field: "key" | "value", val: string) =>
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r))
      ),
    []
  );
  const addRow = useCallback(
    () => setRows((prev) => [...prev, { key: "", value: "" }]),
    []
  );
  const removeRow = useCallback(
    (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx)),
    []
  );

  /* Submit handler */
  const handleDeploy = useCallback(async () => {
    if (!sendAction) return;
    setSubmitting(true);

    /* Build vars dict — skip rows with blank key */
    const vars: Record<string, string> = {};
    for (const { key, value } of rows) {
      const k = key.trim();
      if (k) vars[k] = value;
    }

    sendAction({ action: "provide_env_vars", vars });
    setSubmitted(true);
    setSubmitting(false);
  }, [rows, sendAction]);

  /* If we couldn't parse the payload, show raw content */
  if (!payload) {
    return (
      <Card className="border-primary/20">
        <CardContent className="py-4">
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
            {JSON.stringify(content, null, 2)}
          </pre>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-linear-to-br from-card to-primary/3">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="size-4 text-primary" />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
            Deploy
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Message from the backend */}
        <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
          {payload.message}
        </p>

        {/* ── Env-var rows ─────────────────────────────────────────── */}
        {!submitted && (
          <div className="space-y-2">
            {rows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  className="flex-1 h-8 text-xs font-mono"
                  placeholder="VARIABLE_NAME"
                  value={row.key}
                  onChange={(e) => updateRow(idx, "key", e.target.value)}
                  disabled={submitting}
                />
                <span className="text-muted-foreground text-xs">=</span>
                <Input
                  className="flex-1 h-8 text-xs font-mono"
                  placeholder="value"
                  type="password"
                  value={row.value}
                  onChange={(e) => updateRow(idx, "value", e.target.value)}
                  disabled={submitting}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeRow(idx)}
                  disabled={submitting}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}

            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={addRow}
              disabled={submitting}
            >
              <Plus className="size-3.5 mr-1" />
              Add variable
            </Button>
          </div>
        )}

        {/* ── Deploy / submitted state ─────────────────────────────── */}
        {submitted ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="size-4" />
            <span>Environment variables submitted — deploying…</span>
          </div>
        ) : (
          <Button
            className="w-full"
            onClick={handleDeploy}
            disabled={submitting || !sendAction}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Rocket className="size-4 mr-2" />
                {rows.length > 0 ? "Deploy with Variables" : "Deploy Now"}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
