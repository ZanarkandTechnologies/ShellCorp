"use client";

/**
 * OVERVIEW TAB
 * ============
 * Team charter, stats grid, and member roster for the Team Panel overview tab.
 *
 * KEY CONCEPTS:
 * - Displays team metadata, KPIs, and member list.
 * - Locate All / Clear Highlight for visual member location in office.
 *
 * USAGE:
 * - Rendered inside TeamPanel as the "overview" TabsContent.
 */

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/lib/app-store";
import type { PanelTask } from "./team-panel-types";

type EmployeeModel = {
  _id: string;
  name: string;
  teamId?: string;
  jobTitle?: string;
};

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
  selectedProjectId,
  setSelectedProjectId,
  globalMode,
  hasBusinessConfig,
  currencyFormatter,
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

  const visibleEmployees = globalMode ? employees : teamEmployees;

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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Members</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{visibleEmployees.length}</CardContent>
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
                  const ids = visibleEmployees.map((e) => e._id);
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
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {visibleEmployees.map((employee) => (
                <div key={employee._id} className="rounded-md border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{employee.name}</p>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {employee.jobTitle ?? "operator"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{employee.jobTitle ?? "Operator"}</p>
                </div>
              ))}
              {visibleEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No team members assigned.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
