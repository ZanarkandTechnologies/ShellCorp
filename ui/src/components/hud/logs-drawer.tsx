import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { hasGatewayToken } from "@/lib/gateway-config";
import type {
  SessionRowModel,
  SessionTimelineModel,
  UnifiedOfficeModel,
} from "@/lib/openclaw-types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isConvexEnabled } from "@/providers/convex-provider";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";

type LogsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gatewayBase: string;
};

export function LogsDrawer({
  open,
  onOpenChange,
  gatewayBase,
}: LogsDrawerProps): React.JSX.Element {
  const adapter = useOpenClawAdapter();
  const convexEnabled = isConvexEnabled();
  const [unified, setUnified] = useState<UnifiedOfficeModel | null>(null);
  const [sessions, setSessions] = useState<SessionRowModel[]>([]);
  const [timeline, setTimeline] = useState<SessionTimelineModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [diagStatus, setDiagStatus] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<
    "ok" | "unauthorized" | "unreachable" | "error"
  >("ok");
  const recentAgentEvents = convexEnabled
    ? useQuery(
        api.status.getRecentAgentEvents,
        open
          ? {
              limit: 120,
              windowMs: 120_000,
            }
          : "skip",
      )
    : undefined;

  async function refresh(): Promise<void> {
    setLoading(true);
    setError("");
    setDiagStatus("");
    try {
      const [configSnapshot, runtimeAgents] = await Promise.all([
        adapter.getConfigSnapshot(),
        adapter.listAgents(),
      ]);
      const configAgentsList = Array.isArray(
        (configSnapshot.config.agents as Record<string, unknown> | undefined)?.list,
      )
        ? (((configSnapshot.config.agents as Record<string, unknown>).list as unknown[]) ?? [])
        : [];
      const nextUnified = await adapter.getUnifiedOfficeModel();
      setConnectionStatus("ok");
      setUnified(nextUnified);
      if (configAgentsList.length === 0) {
        setDiagStatus("empty_config: agents.list is empty");
      } else if (runtimeAgents.length === 0) {
        setDiagStatus("empty_runtime: no running agents from /openclaw/agents");
      }
      const selectedAgent = runtimeAgents[0] ?? nextUnified.runtimeAgents[0];
      if (!selectedAgent) {
        setSessions([]);
        setTimeline(null);
        return;
      }
      const nextSessions = await adapter.listSessions(selectedAgent.agentId);
      setSessions(nextSessions);
      const selectedSession = nextSessions[0];
      if (!selectedSession) {
        setTimeline(null);
        return;
      }
      const nextTimeline = await adapter.getSessionTimeline(
        selectedAgent.agentId,
        selectedSession.sessionKey,
        100,
      );
      setTimeline(nextTimeline);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "logs_load_failed";
      setError(message);
      if (message.includes(":401") || message.includes(":403")) {
        setConnectionStatus("unauthorized");
      } else if (message.includes("request_unreachable")) {
        setConnectionStatus("unreachable");
      } else {
        setConnectionStatus("error");
      }
    } finally {
      setLoading(false);
    }
  }

  async function reloadConfig(): Promise<void> {
    try {
      const snapshot = await adapter.getConfigSnapshot();
      const list = (
        ((snapshot.config.agents as Record<string, unknown> | undefined)?.list as unknown[]) ?? []
      ).length;
      setDiagStatus(`config_loaded: agents.list=${list}`);
    } catch (cause) {
      setDiagStatus(
        cause instanceof Error ? `config_load_failed:${cause.message}` : "config_load_failed",
      );
    }
  }

  async function reloadSidecar(): Promise<void> {
    try {
      const company = await adapter.getCompanyModel();
      setDiagStatus(
        `sidecar_loaded: projects=${company.projects.length} agents=${company.agents.length}`,
      );
    } catch (cause) {
      setDiagStatus(
        cause instanceof Error ? `sidecar_load_failed:${cause.message}` : "sidecar_load_failed",
      );
    }
  }

  async function validateLayout(): Promise<void> {
    try {
      const nextUnified = await adapter.getUnifiedOfficeModel();
      const invalidCount = nextUnified.diagnostics.invalidOfficeObjects.length;
      setDiagStatus(`layout_validated: invalid_objects=${invalidCount}`);
      setUnified(nextUnified);
    } catch (cause) {
      setDiagStatus(
        cause instanceof Error
          ? `layout_validation_failed:${cause.message}`
          : "layout_validation_failed",
      );
    }
  }

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open]);

  const liveEventLines = useMemo(() => {
    if (!Array.isArray(recentAgentEvents) || recentAgentEvents.length === 0) return [];
    return recentAgentEvents.slice(0, 120).map((row) => {
      const stamp = new Date(row.occurredAt).toLocaleTimeString();
      const detail = typeof row.detail === "string" && row.detail.trim() ? ` | ${row.detail}` : "";
      return `${stamp} | ${row.agentId} | ${row.eventType} | ${row.label}${detail}`;
    });
  }, [recentAgentEvents]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[88vh] min-w-[88vw] max-w-[1400px] overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Office Live Logs</DialogTitle>
          <DialogDescription>
            OpenClaw + Convex live events, sessions, and reconciliation diagnostics.
          </DialogDescription>
        </DialogHeader>

        <div className="flex h-full min-h-0 flex-col overflow-hidden px-6 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b py-3">
            <div className="space-y-1">
              <p className="text-xs opacity-80">Gateway: {gatewayBase}</p>
              <div className="flex items-center gap-2 text-xs">
                <span className="opacity-80">Auth token:</span>
                <span className={hasGatewayToken() ? "text-green-400" : "text-yellow-400"}>
                  {hasGatewayToken() ? "present" : "missing"}
                </span>
                <span className="opacity-80">Connection:</span>
                <span
                  className={
                    connectionStatus === "ok"
                      ? "text-green-400"
                      : connectionStatus === "unauthorized"
                        ? "text-red-400"
                        : connectionStatus === "unreachable"
                          ? "text-orange-400"
                          : "text-yellow-400"
                  }
                >
                  {connectionStatus}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
                <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" variant="outline" onClick={() => void reloadConfig()}>
                Reload Config
              </Button>
              <Button size="sm" variant="outline" onClick={() => void reloadSidecar()}>
                Reload Sidecar
              </Button>
              <Button size="sm" variant="outline" onClick={() => void validateLayout()}>
                Validate Layout
              </Button>
            </div>
          </div>

          {diagStatus ? <p className="mt-2 text-xs opacity-80">{diagStatus}</p> : null}

          {error ? (
            <div className="mt-2 rounded-md border border-red-400/40 bg-red-500/10 p-2 text-xs text-red-300">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>{error}</span>
              </div>
              {connectionStatus === "unauthorized" ? (
                <p className="mt-1 text-[11px]">
                  Gateway rejected auth. Verify `VITE_GATEWAY_TOKEN` matches OpenClaw gateway token.
                </p>
              ) : null}
              {connectionStatus === "unreachable" ? (
                <p className="mt-1 text-[11px]">
                  Gateway is unreachable. Verify OpenClaw is running at the configured URL and port.
                </p>
              ) : null}
            </div>
          ) : null}

          <Tabs defaultValue="events" className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
            <TabsList className="w-fit">
              <TabsTrigger value="events">Live Events</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
            </TabsList>

            <TabsContent value="events" className="mt-3 min-h-0 flex-1 overflow-hidden">
              <section className="h-full rounded-md border p-2">
                <h4 className="mb-2 text-sm font-semibold">Convex Recent Agent Events (Global)</h4>
                <p className="mb-2 text-[11px] opacity-70">
                  Live feed from `agentEvents` in the last 120 seconds. This is independent from
                  per-agent bubble rendering.
                </p>
                <pre className="h-[calc(100%-42px)] overflow-auto whitespace-pre-wrap break-words rounded bg-black/50 p-2 text-[11px] text-cyan-300">
                  {liveEventLines.join("\n") || "No recent agentEvents found for current window."}
                </pre>
              </section>
            </TabsContent>

            <TabsContent value="sessions" className="mt-3 min-h-0 flex-1 overflow-hidden">
              <div className="grid h-full min-h-0 gap-3 md:grid-cols-[360px,1fr]">
                <section className="min-h-0 rounded-md border p-2">
                  <h4 className="mb-2 text-sm font-semibold">Recent Sessions</h4>
                  <ul className="h-[calc(100%-28px)] space-y-1 overflow-auto text-xs">
                    {sessions.map((session) => (
                      <li key={session.sessionKey} className="rounded border px-2 py-1">
                        {session.sessionKey} {session.channel ? `| ${session.channel}` : ""}
                      </li>
                    ))}
                    {sessions.length === 0 ? (
                      <li className="opacity-70">No sessions loaded.</li>
                    ) : null}
                  </ul>
                </section>

                <section className="min-h-0 rounded-md border p-2">
                  <h4 className="mb-2 text-sm font-semibold">Timeline Events</h4>
                  <pre className="h-[calc(100%-28px)] overflow-auto whitespace-pre-wrap break-words rounded bg-black/50 p-2 text-[11px] text-green-300">
                    {(timeline?.events ?? [])
                      .slice(-100)
                      .map(
                        (event) =>
                          `${new Date(event.ts).toLocaleTimeString()} | ${event.type} | ${event.role} | ${event.text}`,
                      )
                      .join("\n") || "No timeline events loaded."}
                  </pre>
                </section>
              </div>
            </TabsContent>

            <TabsContent value="diagnostics" className="mt-3 min-h-0 flex-1 overflow-hidden">
              <div className="grid h-full min-h-0 gap-3 md:grid-cols-2">
                <section className="rounded-md border p-2">
                  <h4 className="mb-2 text-sm font-semibold">Runtime Snapshot</h4>
                  <p className="text-xs">
                    Configured Agents: {unified?.configuredAgents.length ?? 0}
                  </p>
                  <p className="text-xs">Running Agents: {unified?.runtimeAgents.length ?? 0}</p>
                  <p className="text-xs">Projects: {unified?.company.projects.length ?? 0}</p>
                  <p className="text-xs">Warnings: {unified?.warnings.length ?? 0}</p>
                  {(unified?.configuredAgents.length ?? 0) === 0 ? (
                    <p className="mt-1 text-[11px] text-yellow-400">
                      No configured agents found from `/openclaw/config`.
                    </p>
                  ) : null}
                  {(unified?.runtimeAgents.length ?? 0) === 0 ? (
                    <p className="mt-1 text-[11px] text-yellow-400">
                      No running agents reported by `/openclaw/agents`.
                    </p>
                  ) : null}
                </section>

                <section className="rounded-md border p-2">
                  <h4 className="mb-2 text-sm font-semibold">Reconciliation Warnings</h4>
                  <ul className="max-h-44 space-y-1 overflow-auto text-xs">
                    {(unified?.warnings ?? []).map((warning, index) => (
                      <li key={`${warning.code}-${index}`} className="rounded border px-2 py-1">
                        {warning.code}: {warning.message}
                      </li>
                    ))}
                    {(unified?.warnings.length ?? 0) === 0 ? (
                      <li className="opacity-70">No warnings.</li>
                    ) : null}
                  </ul>
                </section>

                <section className="min-h-0 rounded-md border p-2 md:col-span-2">
                  <h4 className="mb-2 text-sm font-semibold">Config/Sidecar Diagnostics</h4>
                  <p className="text-xs">Company source: {unified?.diagnostics.source ?? "n/a"}</p>
                  <p className="text-xs">
                    Config agents vs runtime: {unified?.diagnostics.configAgentCount ?? 0} /{" "}
                    {unified?.diagnostics.runtimeAgentCount ?? 0}
                  </p>
                  <p className="text-xs">
                    Sidecar mapped agents: {unified?.diagnostics.sidecarAgentCount ?? 0}
                  </p>
                  <p className="text-xs">
                    Office objects: {unified?.diagnostics.officeObjectCount ?? 0}
                  </p>
                  <p className="text-xs">
                    Duplicate object IDs:{" "}
                    {unified?.diagnostics.duplicateOfficeObjectIds.length ?? 0}
                  </p>
                  <p className="text-xs">
                    Clamped clusters needed: {unified?.diagnostics.clampedClusterCount ?? 0}
                  </p>
                  <p className="text-xs">
                    CEO anchor mode: {unified?.diagnostics.ceoAnchorMode ?? "fallback"}
                  </p>
                  <ul className="mt-2 max-h-36 space-y-1 overflow-auto text-xs">
                    {(unified?.diagnostics.missingRuntimeAgentIds ?? []).map((agentId) => (
                      <li key={`missing-${agentId}`} className="rounded border px-2 py-1">
                        missing runtime: {agentId}
                      </li>
                    ))}
                    {(unified?.diagnostics.unmappedRuntimeAgentIds ?? []).map((agentId) => (
                      <li key={`unmapped-${agentId}`} className="rounded border px-2 py-1">
                        unmapped runtime: {agentId}
                      </li>
                    ))}
                    {(unified?.diagnostics.invalidOfficeObjects ?? []).map((objectId) => (
                      <li key={`invalid-object-${objectId}`} className="rounded border px-2 py-1">
                        invalid office object: {objectId}
                      </li>
                    ))}
                    {(unified?.diagnostics.duplicateOfficeObjectIds ?? []).map((objectId) => (
                      <li key={`duplicate-object-${objectId}`} className="rounded border px-2 py-1">
                        duplicate object id: {objectId}
                      </li>
                    ))}
                    {(unified?.diagnostics.outOfBoundsClusterObjectIds ?? []).map((objectId) => (
                      <li
                        key={`out-of-bounds-cluster-${objectId}`}
                        className="rounded border px-2 py-1"
                      >
                        out-of-bounds cluster object: {objectId}
                      </li>
                    ))}
                    {(unified?.diagnostics.missingRuntimeAgentIds.length ?? 0) === 0 &&
                    (unified?.diagnostics.unmappedRuntimeAgentIds.length ?? 0) === 0 &&
                    (unified?.diagnostics.invalidOfficeObjects.length ?? 0) === 0 &&
                    (unified?.diagnostics.duplicateOfficeObjectIds.length ?? 0) === 0 &&
                    (unified?.diagnostics.outOfBoundsClusterObjectIds.length ?? 0) === 0 ? (
                      <li className="opacity-70">No drift diagnostics.</li>
                    ) : null}
                  </ul>
                </section>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
