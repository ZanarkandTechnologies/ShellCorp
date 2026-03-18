"use client";

/**
 * TEAM PANEL
 * ==========
 * Shell component that composes all Team Panel tab components.
 * Opens from team-cluster click with selected team context.
 *
 * KEY CONCEPTS:
 * - Owns shared state: team, project lookups, board actions, builder draft.
 * - Each tab is a modular component receiving derived props.
 * - Kanban is redesigned as a Notion-style board with a task detail modal.
 *
 * USAGE:
 * - Render in Office simulation root.
 * - Drive with app-store activeTeamId + isTeamPanelOpen.
 *
 * MEMORY REFERENCES:
 * - MEM-0100
 * - MEM-0107
 * - MEM-0209
 */

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChatActions } from "@/features/chat-system/chat-store";
import { useAppStore } from "@/lib/app-store";
import { UI_Z } from "@/lib/z-index";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { LedgerTabPanel } from "./business-flow/ledger-tab-panel";
import { BusinessTab } from "./business-tab";
import { KanbanTab } from "./kanban-tab";
import { OverviewTab } from "./overview-tab";
import { ProjectsTab } from "./projects-tab";
import { TeamMemoryTab } from "./team-memory-tab";
import { deriveProjectId, type TabKey } from "./team-panel-types";
import { TimelineTab } from "./timeline-tab";
import { useTeamPanelBoardState } from "./use-team-panel-board";
import { useTeamPanelBusinessState } from "./use-team-panel-business";
import { useTeamPanelMemoryState } from "./use-team-panel-memory";
import { useTeamPanelRuntimeState } from "./use-team-panel-runtime";

interface TeamPanelProps {
  teamId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: TabKey;
  focusAgentId?: string | null;
  globalMode?: boolean;
}

export function TeamPanel({
  teamId,
  isOpen,
  onOpenChange,
  initialTab = "overview",
  focusAgentId = null,
  globalMode = false,
}: TeamPanelProps) {
  const { teams, employees, companyModel, workload, refresh } = useOfficeDataContext();
  const adapter = useOpenClawAdapter();
  const { openEmployeeChat } = useChatActions();
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const setIsAgentSessionPanelOpen = useAppStore((state) => state.setIsAgentSessionPanelOpen);
  const setSelectedAgentId = useAppStore((state) => state.setSelectedAgentId);

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const team = useMemo(() => {
    if (!teamId || globalMode) return null;
    return teams.find((e) => String(e._id) === teamId) ?? null;
  }, [globalMode, teamId, teams]);

  const teamEmployees = useMemo(() => {
    if (!team) return [];
    return employees.filter((e) => String(e.teamId) === String(team._id));
  }, [employees, team]);

  const projectId = globalMode ? selectedProjectId : deriveProjectId(teamId);
  const project = useMemo(() => {
    if (!companyModel) return null;
    if (!projectId) return companyModel.projects[0] ?? null;
    return (
      companyModel.projects.find((e) => e.id === projectId) ?? companyModel.projects[0] ?? null
    );
  }, [companyModel, projectId]);
  const usageEmployees = useMemo(() => {
    if (globalMode) {
      const scopedTeamId = project?.id ? `team-${project.id}`.toLowerCase() : null;
      if (!scopedTeamId) return [];
      return employees.filter(
        (employee) =>
          String(employee.teamId ?? "")
            .trim()
            .toLowerCase() === scopedTeamId,
      );
    }
    return teamEmployees;
  }, [employees, globalMode, project?.id, teamEmployees]);

  const activeProjectId = isOpen ? project?.id : undefined;
  const teamScopeId = useMemo(() => {
    if (globalMode) return project?.id ? `team-${project.id}`.toLowerCase() : null;
    return teamId ? teamId.trim().toLowerCase() : null;
  }, [globalMode, project?.id, teamId]);

  const visibleRoster = useMemo(
    () => (globalMode ? usageEmployees : teamEmployees),
    [globalMode, teamEmployees, usageEmployees],
  );

  const { convexEnabled, projectTasks, communicationRows, boardActionState, handleBoardCommand } =
    useTeamPanelBoardState({
      companyModel,
      globalMode,
      project,
      activeProjectId,
      teamScopeId,
    });

  const { memoryRows, composeState, appendOperatorNote } = useTeamPanelMemoryState({
    activeProjectId,
    teamScopeId,
  });

  const {
    ownerLabelById,
    activityFeedCandidates,
    businessSkillRows,
    presenceRows,
    teamAiUsageSummary,
    teamUsageError,
  } = useTeamPanelRuntimeState({
    adapter,
    isOpen,
    employees,
    teamEmployees,
    visibleRoster,
    usageEmployees,
    globalMode,
    communicationRows,
    projectTasks,
  });

  const {
    builderDraft,
    selectedBusinessSlot,
    setSelectedBusinessSlot,
    trackingContext,
    setTrackingContext,
    builderSaveState,
    ledgerActionState,
    readinessIssues,
    activeExperimentCount,
    hasBusinessConfig,
    accountEvents,
    teamAccount,
    toggleCapabilitySkill,
    handleSaveBusinessBuilder,
    handleRecordAccountEvent,
  } = useTeamPanelBusinessState({
    adapter,
    refresh,
    project,
    team,
    globalMode,
  });

  const projectTaskCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of companyModel?.tasks ?? []) {
      const current = counts.get(task.projectId) ?? 0;
      if (task.status !== "done") counts.set(task.projectId, current + 1);
    }
    if (project?.id) {
      const convexOpen = projectTasks.filter((t) => t.status !== "done").length;
      counts.set(project.id, Math.max(counts.get(project.id) ?? 0, convexOpen));
    }
    return counts;
  }, [companyModel?.tasks, project?.id, projectTasks]);

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

  const allProjects = globalMode ? (companyModel?.projects ?? []) : project ? [project] : [];

  const panelTitle = globalMode ? "All Teams" : (team?.name ?? "Team");

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen || !globalMode || selectedProjectId || !companyModel?.projects?.length) return;
    setSelectedProjectId(companyModel.projects[0].id);
  }, [companyModel?.projects, globalMode, isOpen, selectedProjectId, setSelectedProjectId]);

  if (!globalMode && !team) return null;

  function handleOpenAgentSession(agentId: string): void {
    setSelectedAgentId(agentId);
    setIsAgentSessionPanelOpen(true);
  }

  function handleOpenDirectChat(agentId: string): void {
    void openEmployeeChat(`employee-${agentId}`, true);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="min-w-[70vw] max-w-none h-[90vh] overflow-hidden p-0 flex flex-col"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <span>{panelTitle}</span>
            {project ? <Badge variant="secondary">{project.status}</Badge> : null}
            {project?.businessConfig ? (
              <Badge variant="outline">{project.businessConfig.type}</Badge>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabKey)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6"
        >
          <TabsList className="mt-4 w-fit">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="projects">Artefacts</TabsTrigger>
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <OverviewTab
              team={team}
              panelTitle={panelTitle}
              project={project}
              projectTasks={projectTasks}
              employees={employees}
              teamEmployees={teamEmployees}
              workload={workload}
              companyModel={companyModel}
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
              globalMode={globalMode}
              hasBusinessConfig={hasBusinessConfig}
              currencyFormatter={currencyFormatter}
              aiBurn24hUsd={teamAiUsageSummary.cost24hUsd}
              aiUsageUnavailableText={teamUsageError}
              presenceRows={presenceRows}
              onMessageAgent={handleOpenDirectChat}
              onOpenAgentSession={handleOpenAgentSession}
            />
          </TabsContent>

          <TabsContent value="kanban" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <KanbanTab
              projectTasks={projectTasks}
              focusAgentId={focusAgentId}
              teamEmployees={teamEmployees}
              ownerLabelById={ownerLabelById}
              convexEnabled={convexEnabled}
              boardActionState={boardActionState}
              onBoardCommand={handleBoardCommand}
            />
          </TabsContent>

          <TabsContent value="projects" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <ProjectsTab
              allProjects={allProjects}
              teamId={teamScopeId}
              activeProjectId={project?.id}
              projectTaskCounts={projectTaskCounts}
              companyModel={companyModel}
              globalMode={globalMode}
              setSelectedProjectId={setSelectedProjectId}
              currencyFormatter={currencyFormatter}
            />
          </TabsContent>

          <TabsContent value="memory" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <TeamMemoryTab
              projectId={project?.id ?? null}
              teamId={teamScopeId}
              convexEnabled={convexEnabled}
              memoryRows={memoryRows}
              composeState={composeState}
              onAppendOperatorNote={appendOperatorNote}
            />
          </TabsContent>

          <TabsContent value="timeline" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <TimelineTab
              convexEnabled={convexEnabled}
              teamScopeId={teamScopeId}
              activityFeedCandidates={activityFeedCandidates}
              communicationRows={communicationRows}
            />
          </TabsContent>

          <TabsContent value="business" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <BusinessTab
              builderDraft={builderDraft}
              selectedBusinessSlot={selectedBusinessSlot}
              setSelectedBusinessSlot={setSelectedBusinessSlot}
              onToggleCapabilitySkill={toggleCapabilitySkill}
              trackingContext={trackingContext}
              setTrackingContext={setTrackingContext}
              onSave={handleSaveBusinessBuilder}
              saveState={builderSaveState}
              readinessIssues={readinessIssues}
              fallbackReady={team?.businessReadiness?.ready ?? false}
              activeExperimentCount={activeExperimentCount}
              onViewProjects={() => setActiveTab("projects")}
              resources={project?.resources ?? []}
              hasBusinessConfig={hasBusinessConfig}
              teamSkillRows={businessSkillRows}
            />
          </TabsContent>

          <TabsContent value="ledger" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <LedgerTabPanel
              account={teamAccount}
              events={accountEvents}
              aiUsageSummary={teamAiUsageSummary}
              aiUsageUnavailableText={teamUsageError}
              onRecordEvent={handleRecordAccountEvent}
            />
            {ledgerActionState.error ? (
              <p className="mt-2 text-sm text-destructive">{ledgerActionState.error}</p>
            ) : null}
            {ledgerActionState.ok ? (
              <p className="mt-2 text-sm text-emerald-500">{ledgerActionState.ok}</p>
            ) : null}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
