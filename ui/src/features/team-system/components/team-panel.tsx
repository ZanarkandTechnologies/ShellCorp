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
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  computeBusinessReadinessIssues,
  createBusinessBuilderDraft,
  projectToBusinessBuilderDraft,
} from "@/lib/business-builder";
import { useAppStore } from "@/lib/app-store";
import type { ProjectAccountEventModel } from "@/lib/openclaw-types";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { UI_Z } from "@/lib/z-index";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../../../convex/_generated/api";
import type { BusinessSlotKey } from "./business-flow/business-skill-library";
import { LedgerTabPanel } from "./business-flow/ledger-tab-panel";
import { OverviewTab } from "./overview-tab";
import { KanbanTab } from "./kanban-tab";
import { ProjectsTab } from "./projects-tab";
import { CommunicationsTab } from "./communications-tab";
import { TimelineTab } from "./timeline-tab";
import { BusinessTab } from "./business-tab";
import {
  extractArtefactPath,
  deriveProjectId,
  type TabKey,
  type CommunicationsFilter,
  type PanelTask,
  type ActivityRow,
  type CommunicationRow,
  type AgentCandidate,
} from "./team-panel-types";

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
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [communicationsFilter, setCommunicationsFilter] = useState<CommunicationsFilter>("all");
  const [boardActionState, setBoardActionState] = useState<{
    pending: boolean;
    error?: string;
    ok?: string;
  }>({ pending: false });
  const [builderDraft, setBuilderDraft] = useState(() => createBusinessBuilderDraft("none"));
  const [builderSaveState, setBuilderSaveState] = useState<{
    pending: boolean;
    error?: string;
    ok?: string;
  }>({ pending: false });
  const [selectedBusinessSlot, setSelectedBusinessSlot] = useState<BusinessSlotKey>("measure");
  const [ledgerActionState, setLedgerActionState] = useState<{
    pending: boolean;
    error?: string;
    ok?: string;
  }>({ pending: false });
  const [trackingContext, setTrackingContext] = useState("");
  const [agentConfiguredSkills, setAgentConfiguredSkills] = useState<Record<string, string[]>>({});

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

  const convexEnabled = isConvexEnabled();
  // Closed panels should not keep the board/activity subscriptions hot.
  const activeProjectId = isOpen ? project?.id : undefined;
  const teamScopeId = useMemo(() => {
    if (globalMode) return project?.id ? `team-${project.id}`.toLowerCase() : null;
    return teamId ? teamId.trim().toLowerCase() : null;
  }, [globalMode, project?.id, teamId]);

  const boardCommand = convexEnabled ? useMutation(api.board.boardCommand) : null;
  const convexBoard = convexEnabled
    ? useQuery(api.board.getProjectBoard, activeProjectId ? { projectId: activeProjectId } : "skip")
    : undefined;
  const convexActivity = convexEnabled
    ? useQuery(
        api.board.getProjectActivity,
        activeProjectId
          ? { projectId: activeProjectId, teamId: teamScopeId ?? undefined, limit: 60 }
          : "skip",
      )
    : undefined;

  const projectTasks = useMemo((): PanelTask[] => {
    if (convexEnabled && convexBoard?.tasks) {
      return convexBoard.tasks.map((task) => ({
        id: task.taskId,
        title: task.title,
        status: task.status as PanelTask["status"],
        ownerAgentId: task.ownerAgentId,
        priority: (task.priority as PanelTask["priority"]) ?? "medium",
        provider: (task.provider as PanelTask["provider"]) ?? "internal",
        providerUrl: task.providerUrl,
        artefactPath: extractArtefactPath(task),
        syncState: (task.syncState as PanelTask["syncState"]) ?? "healthy",
        syncError: task.syncError,
        notes: task.notes,
        taskType: task.taskType as PanelTask["taskType"],
        approvalState: task.approvalState as PanelTask["approvalState"],
        linkedSessionKey: task.linkedSessionKey,
        createdTeamId: task.createdTeamId,
        createdProjectId: task.createdProjectId,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        dueAt: task.dueAt,
      }));
    }
    if (!companyModel) return [];
    if (globalMode && !project) return companyModel.tasks as PanelTask[];
    if (!project?.id) return [];
    return companyModel.tasks
      .filter((t) => t.projectId === project.id)
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status as PanelTask["status"],
        ownerAgentId: t.ownerAgentId,
        priority: (t.priority as PanelTask["priority"]) ?? "medium",
        provider: (t.provider as PanelTask["provider"]) ?? "internal",
        providerUrl: t.providerUrl,
        artefactPath: extractArtefactPath(t),
        syncState: (t.syncState as PanelTask["syncState"]) ?? "healthy",
        syncError: t.syncError,
      }));
  }, [companyModel, convexBoard?.tasks, convexEnabled, globalMode, project]);

  const activityRows = useMemo((): ActivityRow[] => {
    if (!Array.isArray(convexActivity)) return [];
    return convexActivity as ActivityRow[];
  }, [convexActivity]);

  const communicationRows = useMemo((): CommunicationRow[] => {
    if (convexEnabled) {
      return activityRows.map((row) => ({
        id: row._id,
        agentId: row.agentId,
        activityType: row.activityType,
        label: row.label,
        detail: row.detail,
        occurredAt: row.occurredAt,
        taskId: row.taskId,
      }));
    }
    return projectTasks.slice(0, 60).map((task) => ({
      id: task.id,
      agentId: task.ownerAgentId ?? "unassigned",
      activityType:
        task.status === "blocked"
          ? "blocked"
          : task.status === "in_progress"
            ? "executing"
            : "planning",
      label: task.title,
      detail: `Priority ${task.priority}`,
      occurredAt: Date.now(),
      taskId: task.id,
    }));
  }, [activityRows, convexEnabled, projectTasks]);

  const filteredCommunicationRows = useMemo((): CommunicationRow[] => {
    if (communicationsFilter === "all") return communicationRows;
    return communicationRows.filter((row) => row.activityType === communicationsFilter);
  }, [communicationRows, communicationsFilter]);

  const activityFeedCandidates = useMemo((): AgentCandidate[] => {
    const roster = globalMode ? employees : teamEmployees;
    return roster
      .map((emp) => {
        const raw = String(emp._id ?? "");
        const agentId = raw.startsWith("employee-") ? raw.slice("employee-".length) : raw;
        return { agentId: agentId.trim(), name: emp.name };
      })
      .filter((e) => e.agentId.length > 0);
  }, [employees, globalMode, teamEmployees]);

  const ownerLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of globalMode ? employees : teamEmployees) {
      map.set(emp._id, emp.name);
      if (emp._id.startsWith("employee-")) {
        map.set(emp._id.replace(/^employee-/, ""), emp.name);
      }
    }
    return map;
  }, [employees, globalMode, teamEmployees]);

  const businessSkillRows = useMemo(
    () =>
      teamEmployees
        .filter(
          (employee) =>
            employee.builtInRole === "biz_pm" || employee.builtInRole === "biz_executor",
        )
        .map((employee) => {
          const rawId = String(employee._id ?? "");
          const agentId = rawId.startsWith("employee-") ? rawId.replace(/^employee-/, "") : rawId;
          return {
            agentId,
            name: employee.name,
            role: employee.builtInRole,
            statusText: employee.statusMessage ?? "Idle",
            heartbeatState: employee.heartbeatState,
            equippedSkills: agentConfiguredSkills[agentId] ?? [],
          };
        }),
    [agentConfiguredSkills, teamEmployees],
  );

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

  const hasBusinessConfig = Boolean(project?.businessConfig);
  const allProjects = globalMode ? (companyModel?.projects ?? []) : project ? [project] : [];

  const activeExperimentCount = useMemo(
    () => (project?.experiments ?? []).filter((e) => e.status === "running").length,
    [project?.experiments],
  );

  const readinessIssues = useMemo(
    () =>
      team?.businessReadiness?.issues && team.businessReadiness.issues.length > 0
        ? team.businessReadiness.issues.map((issue, idx) => ({
            code: `team-${idx}`,
            message: issue,
          }))
        : computeBusinessReadinessIssues(builderDraft),
    [builderDraft, team?.businessReadiness?.issues],
  );

  const accountEvents = useMemo<ProjectAccountEventModel[]>(() => {
    if (project?.accountEvents?.length) return project.accountEvents;
    const ledgerRows = [...(project?.ledger ?? [])].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
    );
    let running = 0;
    return ledgerRows.map((entry) => {
      running += entry.type === "revenue" ? entry.amount : -entry.amount;
      return {
        id: `ledger-derived-${entry.id}`,
        projectId: entry.projectId,
        accountId: `${entry.projectId}:account`,
        timestamp: entry.timestamp,
        type: (entry.type === "revenue" ? "credit" : "debit") as "credit" | "debit",
        amountCents: entry.amount,
        source: entry.source,
        note: entry.description,
        balanceAfterCents: running,
      };
    });
  }, [project?.accountEvents, project?.ledger]);

  const teamAccount = useMemo(() => {
    if (project?.account) return project.account;
    const latest = accountEvents[accountEvents.length - 1];
    return {
      id: `${project?.id ?? "project"}:account`,
      projectId: project?.id ?? "project",
      currency: "USD",
      balanceCents: latest?.balanceAfterCents ?? 0,
      updatedAt: latest?.timestamp ?? new Date().toISOString(),
    };
  }, [accountEvents, project?.account, project?.id]);

  const panelTitle = globalMode ? "All Teams" : (team?.name ?? "Team");

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    setBuilderDraft(projectToBusinessBuilderDraft(project));
    setBuilderSaveState({ pending: false });
    setTrackingContext(project?.trackingContext ?? "");
    setSelectedBusinessSlot("measure");
    setLedgerActionState({ pending: false });
  }, [project?.id]);

  useEffect(() => {
    if (!isOpen || !globalMode || selectedProjectId || !companyModel?.projects?.length) return;
    setSelectedProjectId(companyModel.projects[0].id);
  }, [companyModel?.projects, globalMode, isOpen, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    if (!isOpen) return;
    setCommunicationsFilter("all");
  }, [isOpen, project?.id]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function loadAgentConfiguredSkills(): Promise<void> {
      try {
        const snapshot = await adapter.getConfigSnapshot();
        if (cancelled) return;
        const config = snapshot.config;
        const agentsNode =
          config.agents && typeof config.agents === "object"
            ? (config.agents as Record<string, unknown>)
            : {};
        const list = Array.isArray(agentsNode.list) ? agentsNode.list : [];
        const next: Record<string, string[]> = {};
        for (const entry of list) {
          if (!entry || typeof entry !== "object") continue;
          const row = entry as Record<string, unknown>;
          const id = typeof row.id === "string" ? row.id.trim() : "";
          if (!id) continue;
          const skills = Array.isArray(row.skills)
            ? row.skills.filter((item): item is string => typeof item === "string")
            : [];
          next[id] = skills;
        }
        setAgentConfiguredSkills(next);
      } catch {
        if (!cancelled) setAgentConfiguredSkills({});
      }
    }
    void loadAgentConfiguredSkills();
    return () => {
      cancelled = true;
    };
  }, [adapter, isOpen, project?.id]);

  if (!globalMode && !team) return null;

  function toggleCapabilitySkill(slot: BusinessSlotKey, skillId: string): void {
    setBuilderDraft((current) => {
      const existing = current.capabilitySkills[slot]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const nextSet = new Set(existing);
      if (nextSet.has(skillId)) nextSet.delete(skillId);
      else nextSet.add(skillId);
      return {
        ...current,
        capabilitySkills: { ...current.capabilitySkills, [slot]: [...nextSet].join(", ") },
      };
    });
  }

  async function handleSaveBusinessBuilder(): Promise<void> {
    if (!project?.id) return;
    setBuilderSaveState({ pending: true });
    const saved = await adapter.saveBusinessBuilderConfig({
      projectId: project.id,
      businessType: builderDraft.businessType === "none" ? "custom" : builderDraft.businessType,
      capabilitySkills: builderDraft.capabilitySkills,
      resources: builderDraft.resources,
      trackingContext,
      source: "ui.team_panel.builder",
    });
    if (!saved.ok) {
      setBuilderSaveState({ pending: false, error: saved.error ?? "business_builder_save_failed" });
      return;
    }
    const targetTeamId = globalMode ? `team-${project.id}` : String(team?._id ?? "");
    if (targetTeamId) {
      const sync = await adapter.syncTeamBusinessSkillsToAgents({
        teamId: targetTeamId,
        mode: "replace_minimum",
      });
      if (!sync.ok) {
        await refresh();
        setBuilderSaveState({
          pending: false,
          error: `business_saved_but_skill_sync_failed:${sync.error ?? "unknown_error"}`,
        });
        return;
      }
      await refresh();
      setBuilderSaveState({
        pending: false,
        ok: `Saved. Equipped skills synced for ${sync.touchedAgents.length} agent(s).`,
      });
      return;
    }
    await refresh();
    setBuilderSaveState({ pending: false, ok: "Saved." });
  }

  async function handleBoardCommand(
    command: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ): Promise<void> {
    if (!convexEnabled || !boardCommand || !project?.id) return;
    setBoardActionState({ pending: true });
    try {
      await boardCommand({
        projectId: project.id,
        command,
        actorType: "operator",
        actorAgentId: "operator-ui",
        ...payload,
      });
      setBoardActionState({ pending: false, ok: successMessage });
    } catch (error) {
      const message = error instanceof Error ? error.message : "board_command_failed";
      setBoardActionState({ pending: false, error: message });
    }
  }

  async function handleRecordAccountEvent(input: {
    type: "credit" | "debit";
    amountCents: number;
    source: string;
    note?: string;
  }): Promise<void> {
    if (!project?.id) return;
    setLedgerActionState({ pending: true });
    const result = await adapter.recordProjectAccountEvent({
      projectId: project.id,
      type: input.type,
      amountCents: input.amountCents,
      source: input.source,
      note: input.note,
      currency: teamAccount.currency,
    });
    if (!result.ok) {
      setLedgerActionState({ pending: false, error: result.error ?? "ledger_update_failed" });
      return;
    }
    await refresh();
    setLedgerActionState({
      pending: false,
      ok: input.type === "credit" ? "Funding recorded." : "Spend recorded.",
    });
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
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="communications">Communications</TabsTrigger>
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
              activeProjectId={project?.id}
              projectTaskCounts={projectTaskCounts}
              companyModel={companyModel}
              globalMode={globalMode}
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
              currencyFormatter={currencyFormatter}
            />
          </TabsContent>

          <TabsContent value="communications" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <CommunicationsTab
              communicationsFilter={communicationsFilter}
              setCommunicationsFilter={setCommunicationsFilter}
              filteredRows={filteredCommunicationRows}
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
