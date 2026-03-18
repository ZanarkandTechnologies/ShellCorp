"use client";

/**
 * PROJECTS TAB
 * ============
 * Team Panel Artefacts tab shell.
 *
 * KEY CONCEPTS:
 * - Team-scoped mode opens directly into the current project's artefacts.
 * - Global mode keeps a lightweight scope picker for switching between projects.
 * - Treats each project as a bounded artefact scope instead of a generic workspace browser.
 *
 * USAGE:
 * - Rendered inside TeamPanel as the Artefacts tab content.
 */

import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProjectArtefactPanel } from "./project-artefact-panel";

type ProjectModel = {
  id: string;
  name: string;
  status: string;
  goal?: string;
  kpis?: string[];
  ledger?: { type: string; amount: number }[];
  trackingContext?: string;
  experiments?: { status: string }[];
  resources?: unknown[];
  businessConfig?: unknown;
  account?: unknown;
  accountEvents?: unknown[];
};

type AgentModel = {
  agentId: string;
  projectId?: string;
};

type TaskModel = {
  id: string;
  projectId: string;
  status: string;
  artefactPath?: string;
  title: string;
};

interface ProjectsTabProps {
  allProjects: ProjectModel[];
  teamId?: string | null;
  activeProjectId: string | null | undefined;
  projectTaskCounts: Map<string, number>;
  companyModel: { agents: AgentModel[]; tasks: TaskModel[] } | null;
  globalMode: boolean;
  setSelectedProjectId: (id: string | null) => void;
  currencyFormatter: Intl.NumberFormat;
}

export function ProjectsTab({
  allProjects,
  teamId,
  activeProjectId,
  projectTaskCounts,
  companyModel,
  globalMode,
  setSelectedProjectId,
  currencyFormatter,
}: ProjectsTabProps): ReactElement {
  const [selectedArtefactProjectId, setSelectedArtefactProjectId] = useState<string | null>(null);

  const defaultArtefactProject = useMemo(() => {
    if (!allProjects.length) return null;
    if (!globalMode) return allProjects[0] ?? null;
    if (!selectedArtefactProjectId) return null;
    return allProjects.find((e) => e.id === selectedArtefactProjectId) ?? null;
  }, [allProjects, globalMode, selectedArtefactProjectId]);

  const selectedArtefactProject = defaultArtefactProject;

  const selectedArtefactAgentIds = useMemo(() => {
    if (!selectedArtefactProject || !companyModel) return [];
    return companyModel.agents
      .filter((a) => a.projectId === selectedArtefactProject.id)
      .map((a) => a.agentId);
  }, [companyModel, selectedArtefactProject]);

  const selectedArtefactTaskHints = useMemo(() => {
    if (!selectedArtefactProject || !companyModel) return [];
    return companyModel.tasks
      .filter(
        (t) =>
          t.projectId === selectedArtefactProject.id &&
          typeof t.artefactPath === "string" &&
          t.artefactPath.trim(),
      )
      .slice(0, 40)
      .map((t) => ({
        taskId: t.id,
        title: t.title,
        artefactPath: t.artefactPath,
      }));
  }, [companyModel, selectedArtefactProject]);

  if (selectedArtefactProject) {
    return (
      <ProjectArtefactPanel
        projectId={selectedArtefactProject.id}
        projectName={selectedArtefactProject.name}
        teamId={teamId}
        agentIds={selectedArtefactAgentIds}
        taskHints={selectedArtefactTaskHints}
        trackingContext={selectedArtefactProject.trackingContext}
        onBack={globalMode ? () => setSelectedArtefactProjectId(null) : undefined}
      />
    );
  }

  return (
    <ScrollArea className="h-full pr-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {allProjects.map((entry) => {
          const isActiveProject = activeProjectId === entry.id;
          const openCount = projectTaskCounts.get(entry.id) ?? 0;
          const entryRevenue = (entry.ledger ?? [])
            .filter((row) => row.type === "revenue")
            .reduce((total, row) => total + Math.max(0, Math.round(row.amount)), 0);
          const entryCost = (entry.ledger ?? [])
            .filter((row) => row.type === "cost")
            .reduce((total, row) => total + Math.max(0, Math.round(row.amount)), 0);
          const entryProfit = entryRevenue - entryCost;

          return (
            <Card key={entry.id} className={isActiveProject ? "border-primary/60" : undefined}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">{entry.name}</CardTitle>
                  <Badge variant="secondary">{entry.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="line-clamp-2 text-muted-foreground">
                  {entry.goal || "No goal available."}
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Open tasks</span>
                  <span className="font-medium">{openCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Profit pulse</span>
                  <span
                    className={
                      entryProfit >= 0 ? "font-medium text-emerald-500" : "font-medium text-red-500"
                    }
                  >
                    {currencyFormatter.format(entryProfit / 100)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(entry.kpis ?? []).slice(0, 4).map((kpi) => (
                    <Badge key={`${entry.id}-${kpi}`} variant="outline">
                      {kpi}
                    </Badge>
                  ))}
                  {(entry.kpis ?? []).length === 0 ? (
                    <span className="text-xs text-muted-foreground">No KPIs yet.</span>
                  ) : null}
                </div>
                {globalMode ? (
                  <Button
                    size="sm"
                    variant={isActiveProject ? "secondary" : "outline"}
                    onClick={() => setSelectedProjectId(entry.id)}
                  >
                    {isActiveProject ? "Active scope" : "Focus project"}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedArtefactProjectId(entry.id)}
                >
                  View Artefacts
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {allProjects.length === 0 ? (
          <Card>
            <CardContent className="pt-4 text-sm text-muted-foreground">
              No projects available yet.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </ScrollArea>
  );
}
