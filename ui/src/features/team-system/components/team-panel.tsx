"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/lib/app-store";
import { useOfficeDataContext } from "@/providers/office-data-provider";

/**
 * TEAM PANEL
 * ==========
 * Ported team workspace panel for team-cluster interactions.
 *
 * KEY CONCEPTS:
 * - Opens from team-cluster click with selected team context
 * - Uses OpenClaw-backed office context only (no Convex dependency)
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
  initialTab?: "overview" | "kanban" | "projects" | "communications";
  focusAgentId?: string | null;
  globalMode?: boolean;
}

function deriveProjectId(teamId: string | null): string | null {
  if (!teamId) return null;
  return teamId.startsWith("team-") ? teamId.replace(/^team-/, "") : null;
}

function statusColumns(tasks: Array<{ id: string; title: string; status: "todo" | "in_progress" | "blocked" | "done"; ownerAgentId?: string; priority: string }>): Record<"todo" | "in_progress" | "blocked" | "done", Array<{ id: string; title: string; status: "todo" | "in_progress" | "blocked" | "done"; ownerAgentId?: string; priority: string }>> {
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
  const { teams, employees, companyModel, workload } = useOfficeDataContext();
  const setHighlightedEmployeeIds = useAppStore((state) => state.setHighlightedEmployeeIds);
  const highlightedEmployeeIds = useAppStore((state) => state.highlightedEmployeeIds);
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const [activeTab, setActiveTab] = useState<"overview" | "kanban" | "projects" | "communications">(initialTab);

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
      }));
  }, [companyModel, globalMode, project]);

  const visibleTasks = focusAgentId ? projectTasks.filter((task) => task.ownerAgentId === focusAgentId) : projectTasks;
  const columns = statusColumns(visibleTasks);
  const summary = workload.find((entry) => entry.projectId === (project?.id ?? projectId ?? ""));
  const panelTitle = globalMode ? "All Teams" : team?.name ?? "Team";

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen || !globalMode || selectedProjectId || !companyModel?.projects?.length) return;
    setSelectedProjectId(companyModel.projects[0].id);
  }, [companyModel?.projects, globalMode, isOpen, selectedProjectId, setSelectedProjectId]);

  if (!globalMode && !team) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[70vw] max-w-none h-[90vh] overflow-hidden p-0 z-[1200]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <span>{panelTitle}</span>
            {project ? <Badge variant="secondary">{project.status}</Badge> : null}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="flex h-full flex-col overflow-hidden px-6 pb-6">
          <TabsList className="mt-4 w-fit">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="communications">Communications</TabsTrigger>
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
                        <p>{task.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {task.ownerAgentId ?? "unassigned"} · {task.priority}
                        </p>
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

