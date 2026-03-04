"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessBuilderForm } from "@/components/hud/business-builder-form";
import { computeBusinessReadinessIssues, createBusinessBuilderDraft, projectToBusinessBuilderDraft } from "@/lib/business-builder";
import { useAppStore } from "@/lib/app-store";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { UI_Z } from "@/lib/z-index";

/**
 * TEAM PANEL
 * ==========
 * Ported team workspace panel for team-cluster interactions.
 *
 * KEY CONCEPTS:
 * - Opens from team-cluster click with selected team context
 * - Uses OpenClaw-backed office context only (no legacy backend dependency)
 * - Preserves parity-oriented tabbed shell for operations
 *
 * USAGE:
 * - Render in Office simulation root
 * - Drive with app-store activeTeamId + isTeamPanelOpen
 *
 * MEMORY REFERENCES:
 * - MEM-0100
 * - MEM-0107
 */

interface TeamPanelProps {
  teamId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: "overview" | "kanban" | "projects" | "communications" | "business";
  focusAgentId?: string | null;
  globalMode?: boolean;
}

type KanbanProviderFilter = "all" | "internal" | "notion" | "vibe" | "linear";

type PanelTask = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "blocked" | "done";
  ownerAgentId?: string;
  priority: string;
  provider: "internal" | "notion" | "vibe" | "linear";
  providerUrl?: string;
  syncState: "healthy" | "pending" | "conflict" | "error";
  syncError?: string;
};

function deriveProjectId(teamId: string | null): string | null {
  if (!teamId) return null;
  return teamId.startsWith("team-") ? teamId.replace(/^team-/, "") : null;
}

function statusColumns(tasks: PanelTask[]): Record<"todo" | "in_progress" | "blocked" | "done", PanelTask[]> {
  return {
    todo: tasks.filter((task) => task.status === "todo"),
    in_progress: tasks.filter((task) => task.status === "in_progress"),
    blocked: tasks.filter((task) => task.status === "blocked"),
    done: tasks.filter((task) => task.status === "done"),
  };
}

export function TeamPanel({
  teamId,
  isOpen,
  onOpenChange,
  initialTab = "overview",
  focusAgentId = null,
  globalMode = false,
}: TeamPanelProps) {
  const {
    teams,
    employees,
    companyModel,
    workload,
    refresh,
    manualResync,
    upsertFederationPolicy,
  } =
    useOfficeDataContext();
  const adapter = useOpenClawAdapter();
  const setHighlightedEmployeeIds = useAppStore((state) => state.setHighlightedEmployeeIds);
  const highlightedEmployeeIds = useAppStore((state) => state.highlightedEmployeeIds);
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const [activeTab, setActiveTab] = useState<"overview" | "kanban" | "projects" | "communications" | "business">(initialTab);
  const [providerFilter, setProviderFilter] = useState<KanbanProviderFilter>("all");
  const [resyncState, setResyncState] = useState<{ pending: boolean; error?: string }>({ pending: false });
  const [builderDraft, setBuilderDraft] = useState(() => createBusinessBuilderDraft("none"));
  const [builderSaveState, setBuilderSaveState] = useState<{ pending: boolean; error?: string; ok?: string }>({ pending: false });
  const [previewState, setPreviewState] = useState<{
    pending: boolean;
    role?: "biz_pm" | "biz_executor";
    text?: string;
    error?: string;
  }>({ pending: false });

  const team = useMemo(() => {
    if (!teamId || globalMode) return null;
    return teams.find((entry) => String(entry._id) === teamId) ?? null;
  }, [globalMode, teamId, teams]);

  const teamEmployees = useMemo(() => {
    if (!team) return [];
    return employees.filter((employee) => String(employee.teamId) === String(team._id));
  }, [employees, team]);

  const projectId = globalMode ? selectedProjectId : deriveProjectId(teamId);
  const project = useMemo(() => {
    if (!companyModel) return null;
    if (!projectId) return companyModel.projects[0] ?? null;
    return companyModel.projects.find((entry) => entry.id === projectId) ?? companyModel.projects[0] ?? null;
  }, [companyModel, projectId]);

  const projectTasks = useMemo(() => {
    if (!companyModel) return [];
    if (globalMode && !project) return companyModel.tasks;
    if (!project?.id) return [];
    return companyModel.tasks
      .filter((task) => task.projectId === project.id)
      .map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        ownerAgentId: task.ownerAgentId,
        priority: task.priority,
        provider: task.provider,
        providerUrl: task.providerUrl,
        syncState: task.syncState,
        syncError: task.syncError,
      }));
  }, [companyModel, globalMode, project]);

  const policy = useMemo(() => {
    if (!project?.id || !companyModel) return null;
    return companyModel.federationPolicies.find((entry) => entry.projectId === project.id) ?? null;
  }, [companyModel, project?.id]);

  const visibleTasks = useMemo(() => {
    const scopedByAgent = focusAgentId ? projectTasks.filter((task) => task.ownerAgentId === focusAgentId) : projectTasks;
    if (providerFilter === "all") return scopedByAgent;
    return scopedByAgent.filter((task) => task.provider === providerFilter);
  }, [focusAgentId, projectTasks, providerFilter]);
  const columns = statusColumns(visibleTasks);
  const summary = workload.find((entry) => entry.projectId === (project?.id ?? projectId ?? ""));
  const panelTitle = globalMode ? "All Teams" : team?.name ?? "Team";
  const projectRevenueCents = (project?.ledger ?? [])
    .filter((entry) => entry.type === "revenue")
    .reduce((total, entry) => total + Math.max(0, Math.round(entry.amount)), 0);
  const projectCostCents = (project?.ledger ?? [])
    .filter((entry) => entry.type === "cost")
    .reduce((total, entry) => total + Math.max(0, Math.round(entry.amount)), 0);
  const projectProfitCents = projectRevenueCents - projectCostCents;
  const hasBusinessConfig = Boolean(project?.businessConfig);
  const resourceRows = (project?.resources ?? []).map((resource) => {
    const softLimit = resource.policy.softLimit;
    const hardLimit = resource.policy.hardLimit;
    const health =
      typeof hardLimit === "number" && resource.remaining <= hardLimit
        ? "depleted"
        : typeof softLimit === "number" && resource.remaining <= softLimit
          ? "warning"
          : "healthy";
    return { ...resource, health };
  });
  const resourceEvents = (project?.resourceEvents ?? []).slice().reverse().slice(0, 12);
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    setBuilderDraft(projectToBusinessBuilderDraft(project));
    setBuilderSaveState({ pending: false });
    setPreviewState({ pending: false });
  }, [project?.id]);

  useEffect(() => {
    if (!isOpen || !globalMode || selectedProjectId || !companyModel?.projects?.length) return;
    setSelectedProjectId(companyModel.projects[0].id);
  }, [companyModel?.projects, globalMode, isOpen, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    if (!isOpen) return;
    setProviderFilter("all");
    setResyncState({ pending: false });
  }, [isOpen, project?.id]);

  if (!globalMode && !team) return null;

  async function handleManualResync(): Promise<void> {
    if (!project?.id) return;
    setResyncState({ pending: true });
    const targetProvider = providerFilter === "all" ? undefined : providerFilter;
    const result = await manualResync(project.id, targetProvider);
    setResyncState({ pending: false, error: result.ok ? undefined : result.error ?? "manual_resync_failed" });
  }

  async function handleSavePolicy(nextCanonical: "internal" | "notion" | "vibe" | "linear"): Promise<void> {
    if (!project?.id) return;
    await upsertFederationPolicy({
      projectId: project.id,
      canonicalProvider: nextCanonical,
      mirrors: policy?.mirrors ?? [],
      writeBackEnabled: policy?.writeBackEnabled ?? false,
      conflictPolicy: policy?.conflictPolicy ?? "canonical_wins",
    });
  }

  async function handleSaveBusinessBuilder(): Promise<void> {
    if (!project?.id || builderDraft.businessType === "none") return;
    setBuilderSaveState({ pending: true });
    const saved = await adapter.saveBusinessBuilderConfig({
      projectId: project.id,
      businessType: builderDraft.businessType,
      capabilitySkills: builderDraft.capabilitySkills,
      resources: builderDraft.resources,
      source: "ui.team_panel.builder",
    });
    if (!saved.ok) {
      setBuilderSaveState({ pending: false, error: saved.error ?? "business_builder_save_failed" });
      return;
    }
    await refresh();
    setBuilderSaveState({ pending: false, ok: "Saved." });
  }

  async function handlePreview(role: "biz_pm" | "biz_executor"): Promise<void> {
    if (!project?.id || !teamId) return;
    if (previewState.role === role && previewState.text) {
      setPreviewState({ pending: false });
      return;
    }
    setPreviewState({ pending: true, role });
    const preview = await adapter.renderBusinessHeartbeatPreview({ teamId, role });
    if (!preview.ok) {
      setPreviewState({ pending: false, role, error: preview.error ?? "heartbeat_preview_failed" });
      return;
    }
    setPreviewState({ pending: false, role, text: preview.rendered });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[70vw] max-w-none h-[90vh] overflow-hidden p-0" style={{ zIndex: UI_Z.panelElevated }}>
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <span>{panelTitle}</span>
            {project ? <Badge variant="secondary">{project.status}</Badge> : null}
            {project?.businessConfig ? <Badge variant="outline">{project.businessConfig.type}</Badge> : null}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as "overview" | "kanban" | "projects" | "communications" | "business")
          }
          className="flex h-full flex-col overflow-hidden px-6 pb-6"
        >
          <TabsList className="mt-4 w-fit">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="communications">Communications</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 flex-1 overflow-hidden">
            <ScrollArea className="h-full pr-3">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Team Mission</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {project?.goal ?? team?.description ?? "No mission details available yet."}
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

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Members</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{globalMode ? employees.length : teamEmployees.length}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Open Tickets</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{summary?.openTickets ?? projectTasks.filter((task) => task.status !== "done").length}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Queue Pressure</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold capitalize">{summary?.queuePressure ?? "low"}</CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Team Members</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          const ids = globalMode ? employees.map((employee) => employee._id) : teamEmployees.map((employee) => employee._id);
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
                    <div className="space-y-2">
                      {(globalMode ? employees : teamEmployees).map((employee) => (
                        <div key={employee._id} className="rounded-md border p-2">
                          <p className="text-sm font-medium">{employee.name}</p>
                          <p className="text-xs text-muted-foreground">{employee.jobTitle ?? "Operator"}</p>
                        </div>
                      ))}
                      {(globalMode ? employees.length : teamEmployees.length) === 0 ? (
                        <p className="text-sm text-muted-foreground">No team members assigned.</p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="kanban" className="mt-4 flex-1 overflow-hidden">
            {focusAgentId ? (
              <div className="mb-3 rounded-md border bg-muted/40 p-2 text-xs">
                Showing tasks owned by `{focusAgentId}` in this panel scope.
              </div>
            ) : null}
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-2">
              <label className="text-xs text-muted-foreground">Provider</label>
              <select
                className="rounded-md border bg-background px-2 py-1 text-xs"
                value={providerFilter}
                onChange={(event) => setProviderFilter(event.target.value as KanbanProviderFilter)}
              >
                <option value="all">all</option>
                <option value="internal">internal</option>
                <option value="notion">notion</option>
                <option value="vibe">vibe</option>
                <option value="linear">linear</option>
              </select>
              <label className="text-xs text-muted-foreground">Canonical</label>
              <select
                className="rounded-md border bg-background px-2 py-1 text-xs"
                value={policy?.canonicalProvider ?? "internal"}
                onChange={(event) => void handleSavePolicy(event.target.value as "internal" | "notion" | "vibe" | "linear")}
              >
                <option value="internal">internal</option>
                <option value="notion">notion</option>
                <option value="vibe">vibe</option>
                <option value="linear">linear</option>
              </select>
              <Button size="sm" variant="outline" onClick={() => void handleManualResync()} disabled={resyncState.pending}>
                {resyncState.pending ? "Resyncing..." : "Manual Resync"}
              </Button>
              {resyncState.error ? <span className="text-xs text-red-500">{resyncState.error}</span> : null}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(["todo", "in_progress", "blocked", "done"] as const).map((status) => (
                <Card key={status}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm capitalize">
                      {status.replace("_", " ")} ({columns[status].length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {columns[status].map((task) => (
                      <div key={task.id} className="rounded-md border p-2 text-sm">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="truncate">{task.title}</p>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {task.provider}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {task.ownerAgentId ?? "unassigned"} · {task.priority}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge
                            variant={
                              task.syncState === "healthy"
                                ? "secondary"
                                : task.syncState === "pending"
                                  ? "outline"
                                  : task.syncState === "conflict"
                                    ? "default"
                                    : "destructive"
                            }
                            className="text-[10px]"
                          >
                            {task.syncState}
                          </Badge>
                          {task.providerUrl ? (
                            <a
                              href={task.providerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-primary underline-offset-2 hover:underline"
                            >
                              Open
                            </a>
                          ) : null}
                        </div>
                        {task.syncError ? <p className="mt-1 text-[10px] text-red-500">{task.syncError}</p> : null}
                      </div>
                    ))}
                    {columns[status].length === 0 ? <p className="text-xs text-muted-foreground">No tasks.</p> : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="projects" className="mt-4 flex-1 overflow-hidden">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Project Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Project:</span> {project?.name ?? "No project mapped"}
                </p>
                <p>
                  <span className="font-medium">Goal:</span> {project?.goal ?? "No goal available"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(project?.kpis ?? []).map((kpi) => (
                    <Badge key={kpi} variant="outline">
                      {kpi}
                    </Badge>
                  ))}
                  {(project?.kpis ?? []).length === 0 ? <span className="text-xs text-muted-foreground">No KPI keys configured.</span> : null}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="communications" className="mt-4 flex-1 overflow-hidden">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Communication Handoff</CardTitle>
              </CardHeader>
              <CardContent className="h-[calc(100%-3rem)] overflow-hidden">
                <ScrollArea className="h-full rounded-md border p-3">
                  <div className="space-y-2">
                    {projectTasks.slice(0, 30).map((task) => (
                      <div key={task.id} className="rounded-md border p-2 text-sm">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <Badge variant="secondary">{task.ownerAgentId ?? "unassigned"}</Badge>
                          <span className="text-xs text-muted-foreground">{task.status}</span>
                        </div>
                        <p>{task.title}</p>
                      </div>
                    ))}
                    {projectTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No communication items yet. This team panel is ready, and live message streams will appear as OpenClaw events are mapped.
                      </p>
                    ) : null}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="business" className="mt-4 flex-1 overflow-hidden">
            <ScrollArea className="h-full pr-2">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Business Builder</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <BusinessBuilderForm value={builderDraft} onChange={setBuilderDraft} disabled={builderSaveState.pending} />
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => void handleSaveBusinessBuilder()} disabled={builderSaveState.pending || builderDraft.businessType === "none"}>
                        {builderSaveState.pending ? "Saving..." : "Save Business Config"}
                      </Button>
                      <Button variant="outline" onClick={() => void handlePreview("biz_pm")} disabled={previewState.pending || builderDraft.businessType === "none"}>
                        Preview PM Heartbeat
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void handlePreview("biz_executor")}
                        disabled={previewState.pending || builderDraft.businessType === "none"}
                      >
                        Preview Executor Heartbeat
                      </Button>
                      {previewState.text ? (
                        <Button variant="ghost" onClick={() => setPreviewState({ pending: false })} disabled={previewState.pending}>
                          Close Preview
                        </Button>
                      ) : null}
                    </div>
                    {builderSaveState.error ? <p className="text-sm text-destructive">{builderSaveState.error}</p> : null}
                    {builderSaveState.ok ? <p className="text-sm text-emerald-500">{builderSaveState.ok}</p> : null}
                    {previewState.error ? <p className="text-sm text-destructive">{previewState.error}</p> : null}
                    {previewState.text ? (
                      <ScrollArea className="max-h-44 rounded-md border p-2">
                        <pre className="text-xs whitespace-pre-wrap">{previewState.text}</pre>
                      </ScrollArea>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Readiness Checklist</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {(team?.businessReadiness?.issues && team.businessReadiness.issues.length > 0
                      ? team.businessReadiness.issues.map((issue) => ({ message: issue }))
                      : computeBusinessReadinessIssues(builderDraft)
                    ).map((issue, index) => (
                      <p key={`${issue.message}-${index}`} className="text-amber-500">
                        - {issue.message}
                      </p>
                    ))}
                    {(team?.businessReadiness?.ready ?? computeBusinessReadinessIssues(builderDraft).length === 0) ? (
                      <p className="text-emerald-500">Ready to run.</p>
                    ) : null}
                  </CardContent>
                </Card>
                {hasBusinessConfig ? (
                  <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Revenue</CardTitle>
                      </CardHeader>
                      <CardContent className="text-2xl font-semibold text-emerald-500">
                        {currencyFormatter.format(projectRevenueCents / 100)}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Costs</CardTitle>
                      </CardHeader>
                      <CardContent className="text-2xl font-semibold text-amber-500">
                        {currencyFormatter.format(projectCostCents / 100)}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Profit</CardTitle>
                      </CardHeader>
                      <CardContent className={`text-2xl font-semibold ${projectProfitCents >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {currencyFormatter.format(projectProfitCents / 100)}
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Capability Slots</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-3 text-sm">
                      <div className="rounded-md border p-2">
                        <p className="font-medium">Measure</p>
                        <p className="text-muted-foreground">{project?.businessConfig?.slots.measure.skillId ?? "not-set"}</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <p className="font-medium">Execute</p>
                        <p className="text-muted-foreground">{project?.businessConfig?.slots.execute.skillId ?? "not-set"}</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <p className="font-medium">Distribute</p>
                        <p className="text-muted-foreground">{project?.businessConfig?.slots.distribute.skillId ?? "not-set"}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Resources</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {resourceRows.map((resource) => (
                        <div key={resource.id} className="rounded-md border p-2 text-sm">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="font-medium">{resource.name}</p>
                            <Badge
                              variant={
                                resource.health === "healthy" ? "secondary" : resource.health === "warning" ? "outline" : "destructive"
                              }
                            >
                              {resource.health}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {resource.remaining} / {resource.limit} {resource.unit}
                            {typeof resource.reserved === "number" ? ` (reserved ${resource.reserved})` : ""}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            tracker: {resource.trackerSkillId} | low-policy: {resource.policy.whenLow}
                          </p>
                        </div>
                      ))}
                      {resourceRows.length === 0 ? <p className="text-xs text-muted-foreground">No resources configured yet.</p> : null}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Experiments</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {(project?.experiments ?? []).slice().reverse().slice(0, 8).map((experiment) => (
                        <div key={experiment.id} className="rounded-md border p-2 text-sm">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="font-medium">{experiment.hypothesis}</p>
                            <Badge variant="outline">{experiment.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            started {new Date(experiment.startedAt).toLocaleString()}
                            {experiment.endedAt ? ` -> ended ${new Date(experiment.endedAt).toLocaleString()}` : ""}
                          </p>
                          {experiment.results ? <p className="mt-1 text-xs">{experiment.results}</p> : null}
                        </div>
                      ))}
                      {(project?.experiments ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">No experiments logged yet.</p>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Recent Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {(project?.metricEvents ?? []).slice().reverse().slice(0, 10).map((event) => (
                        <div key={event.id} className="rounded-md border p-2 text-xs">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="font-medium">{event.source}</span>
                            <span className="text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-muted-foreground break-all">{JSON.stringify(event.metrics)}</p>
                        </div>
                      ))}
                      {(project?.metricEvents ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">No metric events recorded yet.</p>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Resource Events</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {resourceEvents.map((event) => (
                        <div key={event.id} className="rounded-md border p-2 text-xs">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="font-medium">{event.kind}</span>
                            <span className="text-muted-foreground">{new Date(event.ts).toLocaleString()}</span>
                          </div>
                          <p className="text-muted-foreground">
                            {event.resourceId} | delta {event.delta} | remaining {event.remainingAfter}
                          </p>
                          <p className="text-muted-foreground">{event.source}</p>
                          {event.note ? <p className="text-muted-foreground">{event.note}</p> : null}
                        </div>
                      ))}
                      {resourceEvents.length === 0 ? <p className="text-xs text-muted-foreground">No resource events yet.</p> : null}
                    </CardContent>
                  </Card>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="pt-4 text-sm text-muted-foreground">
                      Configure business type, capability skills, and resources above, then save to initialize Business telemetry.
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

