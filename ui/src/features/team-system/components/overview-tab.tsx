"use client";

/**
 * OVERVIEW TAB
 * ============
 * Team charter, stats grid, and compact roster-first member oversight for the Team Panel overview tab.
 *
 * KEY CONCEPTS:
 * - Displays team metadata, KPIs, and a compact member card grid.
 * - Each roster card embeds a lightweight 3D character preview plus quick actions.
 *
 * USAGE:
 * - Rendered inside TeamPanel as the "overview" TabsContent.
 *
 * MEMORY REFERENCES:
 * - MEM-0196
 */

import { Box } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import { MessageSquare, Radio, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BODY_HEIGHT,
  BODY_WIDTH,
  HAIR_HEIGHT,
  HAIR_WIDTH,
  HEAD_HEIGHT,
  HEAD_WIDTH,
  LEG_HEIGHT,
  TOTAL_HEIGHT,
} from "@/constants";
import { useAppStore } from "@/lib/app-store";
import {
  PRIORITY_COLORS,
  STATUS_LABELS,
  type AgentPresenceRow,
  type PanelTask,
} from "./team-panel-types";
import {
  formatRelativeTime,
  resolvePreviewPalette,
  type AvatarPalette,
} from "./overview-tab.helpers";

type WorkloadSummary = {
  projectId: string;
  openTickets: number;
  queuePressure: string;
};

type ProjectModel = {
  id: string;
  name: string;
  status: string;
  goal?: string;
  kpis?: string[];
  businessConfig?: unknown;
  ledger?: { type: string; amount: number }[];
  account?: unknown;
  accountEvents?: unknown[];
};

type TeamModel = {
  _id: string;
  name: string;
  description?: string;
  businessReadiness?: { ready: boolean; issues: string[] };
};

type EmployeeModel = {
  _id: string;
  name: string;
  teamId?: string;
  jobTitle?: string;
  profileImageUrl?: string;
  status?: string;
  statusMessage?: string;
};

interface OverviewTabProps {
  team: TeamModel | null;
  panelTitle: string;
  project: ProjectModel | null;
  projectTasks: PanelTask[];
  employees: EmployeeModel[];
  teamEmployees: EmployeeModel[];
  workload: WorkloadSummary[];
  companyModel: { projects: ProjectModel[] } | null;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  globalMode: boolean;
  hasBusinessConfig: boolean;
  currencyFormatter: Intl.NumberFormat;
  aiBurn24hUsd: number;
  aiUsageUnavailableText?: string | null;
  presenceRows: AgentPresenceRow[];
  onMessageAgent: (agentId: string) => void;
  onOpenAgentSession: (agentId: string) => void;
}

function EmployeePreviewMesh({ palette }: { palette: AvatarPalette }): JSX.Element {
  const baseY = -TOTAL_HEIGHT / 2;
  return (
    <group position={[0, -0.18, 0]} rotation={[0.08, -0.38, 0]}>
      <Box
        args={[BODY_WIDTH, LEG_HEIGHT, BODY_WIDTH * 0.6]}
        position={[0, baseY + LEG_HEIGHT / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.pants} />
      </Box>
      <Box
        args={[BODY_WIDTH, BODY_HEIGHT, BODY_WIDTH * 0.6]}
        position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.shirt} />
      </Box>
      <Box
        args={[HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH]}
        position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.skin} />
      </Box>
      <Box
        args={[HAIR_WIDTH, HAIR_HEIGHT, HAIR_WIDTH]}
        position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT + HAIR_HEIGHT / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.hair} />
      </Box>
    </group>
  );
}

function MiniEmployeePreview({ seed }: { seed: string }): JSX.Element {
  const palette = useMemo(() => resolvePreviewPalette(seed), [seed]);

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="h-28 w-28">
        <Canvas camera={{ position: [0, 0.5, 3.1], fov: 24 }}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[2, 3, 4]} intensity={2.1} />
          <directionalLight position={[-2, 1.5, 2]} intensity={0.7} />
          <group scale={1.65}>
            <EmployeePreviewMesh palette={palette} />
          </group>
        </Canvas>
      </div>
    </div>
  );
}

export function OverviewTab({
  team,
  panelTitle,
  project,
  projectTasks,
  employees,
  teamEmployees,
  workload,
  companyModel,
  setSelectedProjectId,
  globalMode,
  hasBusinessConfig,
  currencyFormatter,
  aiBurn24hUsd,
  aiUsageUnavailableText,
  presenceRows,
  onMessageAgent,
  onOpenAgentSession,
}: OverviewTabProps): JSX.Element {
  const setHighlightedEmployeeIds = useAppStore((state) => state.setHighlightedEmployeeIds);
  const highlightedEmployeeIds = useAppStore((state) => state.highlightedEmployeeIds);

  const summary = workload.find((entry) => entry.projectId === (project?.id ?? ""));

  const projectRevenueCents = (project?.ledger ?? [])
    .filter((entry) => entry.type === "revenue")
    .reduce((total, entry) => total + Math.max(0, Math.round(entry.amount)), 0);
  const projectCostCents = (project?.ledger ?? [])
    .filter((entry) => entry.type === "cost")
    .reduce((total, entry) => total + Math.max(0, Math.round(entry.amount)), 0);
  const projectProfitCents = projectRevenueCents - projectCostCents;

  const teamKpis = project?.kpis ?? [];
  const aiCurrencyFormatter = useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
    [],
  );

  const normalizedProjectGoal = project?.goal?.trim() ?? "";
  const normalizedTeamDescription = team?.description?.trim() ?? "";
  const cleanedTeamDescription = normalizedTeamDescription
    .replace(/\s*\|\s*open=\d+\s*closed=\d+\s*$/i, "")
    .trim();
  const teamBusinessDescription =
    cleanedTeamDescription.length > 0 && cleanedTeamDescription !== normalizedProjectGoal
      ? cleanedTeamDescription
      : "";
  const teamGoal =
    normalizedProjectGoal || "No goal set yet. Use the team CLI to define a clear business target.";

  return (
    <ScrollArea className="h-full pr-3">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm">Team Charter</CardTitle>
              <div className="flex items-center gap-2">
                {hasBusinessConfig ? (
                  <Badge variant="outline">Business configured</Badge>
                ) : (
                  <Badge variant="secondary">Builder mode</Badge>
                )}
                <Badge variant="secondary">{project?.status ?? "active"}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <div className="space-y-1 rounded-md border bg-muted/20 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Team Name</p>
              <p className="font-medium">{team?.name ?? panelTitle}</p>
            </div>
            <div className="space-y-1 rounded-md border bg-muted/20 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Business Description
              </p>
              <p className="text-muted-foreground">
                {teamBusinessDescription ||
                  "No business description set yet. Use `team update --description` to define what this team does."}
              </p>
            </div>
            <div className="space-y-1 rounded-md border bg-muted/20 p-3 md:col-span-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Goal</p>
              <p>{teamGoal}</p>
            </div>
            <div className="space-y-2 rounded-md border bg-muted/20 p-3 md:col-span-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">KPIs</p>
              {teamKpis.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {teamKpis.map((kpi) => (
                    <Badge key={`overview-kpi-${kpi}`} variant="outline">
                      {kpi}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  No KPIs set yet. Add KPI targets with `team kpi set` for this team.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {globalMode && companyModel?.projects?.length ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Project Scope</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                className="rounded-md border bg-background px-2 py-1 text-sm"
                value={project?.id ?? ""}
                onChange={(event) => setSelectedProjectId(event.target.value || null)}
              >
                {companyModel.projects.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Members</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{presenceRows.length}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Open Tickets</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {summary?.openTickets ?? projectTasks.filter((t) => t.status !== "done").length}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Queue Pressure</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold capitalize">
              {summary?.queuePressure ?? "low"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Profit Pulse</CardTitle>
            </CardHeader>
            <CardContent
              className={`text-2xl font-semibold ${projectProfitCents >= 0 ? "text-emerald-500" : "text-red-500"}`}
            >
              {hasBusinessConfig ? currencyFormatter.format(projectProfitCents / 100) : "--"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">AI Burn 24h</CardTitle>
                {aiUsageUnavailableText ? (
                  <Badge variant="outline" className="text-[10px]">
                    Partial
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold">{aiCurrencyFormatter.format(aiBurn24hUsd)}</p>
              {aiUsageUnavailableText ? (
                <p className="text-xs text-muted-foreground">{aiUsageUnavailableText}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm">Team Members</CardTitle>
              <span className="text-xs text-muted-foreground">Mission crew</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const ids = (globalMode ? employees : teamEmployees).map((entry) => entry._id);
                  setHighlightedEmployeeIds(ids);
                }}
              >
                Locate All
              </Button>
              {highlightedEmployeeIds.size > 0 ? (
                <Button variant="outline" size="sm" onClick={() => setHighlightedEmployeeIds(null)}>
                  Clear Highlight
                </Button>
              ) : null}
            </div>

            {presenceRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No team members assigned.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {presenceRows.map((presence) => (
                  <div
                    key={presence.employeeId}
                    className="rounded-md border bg-muted/20 p-3 transition hover:border-border hover:bg-muted/30"
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0">
                        <MiniEmployeePreview seed={`${presence.employeeId}:${presence.name}`} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-medium">{presence.name}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {presence.roleLabel}
                              </Badge>
                              {presence.liveState ? (
                                <Badge variant="secondary" className="text-[10px] uppercase">
                                  {presence.liveState}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {formatRelativeTime(presence.latestOccurredAt)}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => setHighlightedEmployeeIds([presence.employeeId])}
                          >
                            Locate
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground">Current State</p>
                            <p className="text-sm font-medium">{presence.statusText}</p>
                          </div>
                          <div className="rounded-md border bg-background/40 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Latest Task
                              </p>
                              {presence.latestTaskStatus ? (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] uppercase ${PRIORITY_COLORS[presence.latestTaskPriority ?? "medium"]}`}
                                >
                                  {STATUS_LABELS[presence.latestTaskStatus]}
                                </Badge>
                              ) : null}
                            </div>
                            {presence.latestTaskTitle ? (
                              <>
                                <p className="text-sm font-medium">{presence.latestTaskTitle}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {presence.latestTaskDetail ?? "No task detail yet."}
                                </p>
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No assigned task yet. This agent is currently available for new
                                work.
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <span>{presence.openTaskCount} open</span>
                              <span>{presence.blockedTaskCount} blocked</span>
                              <span>{presence.completedTaskCount} done</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => onMessageAgent(presence.agentId)}>
                            <MessageSquare className="mr-2 h-3.5 w-3.5" />
                            Message
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenAgentSession(presence.agentId)}
                          >
                            <Radio className="mr-2 h-3.5 w-3.5" />
                            Open Session
                          </Button>
                          <Badge variant="secondary" className="px-2 py-1 text-[10px] uppercase">
                            <Send className="mr-1 h-3 w-3" />
                            Board-first
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
