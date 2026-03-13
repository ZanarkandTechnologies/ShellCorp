"use client";

import React, {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { normalizeOfficeObjectId } from "@/features/office-system/components/office-object-id";
import {
  buildSkillTargetObjectMap,
  getOfficeSkillAnchorPositionForOccupant,
} from "@/features/office-system/skill-targeting";
import {
  getAbsoluteDeskPosition,
  getDeskRotation,
  getEmployeePositionAtDesk,
} from "@/features/office-system/utils/layout";
import { useAgentLiveStatuses } from "@/hooks/use-agent-live-status";
import {
  computeBusinessReadinessIssues,
  projectToBusinessBuilderDraft,
} from "@/lib/business-builder";
import { DEFAULT_OFFICE_FOOTPRINT } from "@/lib/office-footprint";
import {
  clampPositionToOfficeLayout,
  createRectangularOfficeLayout,
  getManagementAnchorFromOfficeLayout,
  type OfficeLayoutModel,
} from "@/lib/office-layout";
import type { OpenClawAdapter } from "@/lib/openclaw-adapter";
import type {
  AgentCardModel,
  AgentLiveStatus,
  CompanyModel,
  FederatedTaskProvider,
  FederationProjectPolicy,
  OfficeSettingsModel,
  PendingApprovalModel,
  ProjectWorkloadSummary,
  ProviderIndexProfile,
  ReconciliationWarning,
  UnifiedOfficeModel,
} from "@/lib/openclaw-types";
import type { Company, DeskLayoutData, EmployeeData, OfficeObject, TeamData } from "@/lib/types";
import { stabilizeOfficeData } from "@/providers/office-data-stability";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";

interface OfficeDataContextType {
  company: Company | null;
  teams: TeamData[];
  employees: EmployeeData[];
  officeObjects: OfficeObject[];
  desks: DeskLayoutData[];
  officeSettings: OfficeSettingsModel;
  companyModel: CompanyModel | null;
  workload: ProjectWorkloadSummary[];
  warnings: ReconciliationWarning[];
  refresh: () => Promise<void>;
  applyOfficeSettings: (settings: OfficeSettingsModel) => void;
  manualResync: (
    projectId: string,
    provider?: FederatedTaskProvider,
  ) => Promise<{ ok: boolean; error?: string }>;
  upsertFederationPolicy: (
    policy: FederationProjectPolicy,
  ) => Promise<{ ok: boolean; error?: string }>;
  upsertProviderIndexProfile: (
    profile: ProviderIndexProfile,
  ) => Promise<{ ok: boolean; error?: string }>;
  isLoading: boolean;
}

const OfficeDataContext = createContext<OfficeDataContextType | undefined>(undefined);
const CLUSTER_MARGIN = 2;

const demoCompany: Company = { _id: "company-demo", name: "Shell Company" };

function clampClusterPositionForLayout(
  position: [number, number, number],
  layout: OfficeLayoutModel,
): { position: [number, number, number]; clamped: boolean } {
  const next = clampPositionToOfficeLayout(position, layout, CLUSTER_MARGIN);
  return {
    position: next,
    clamped: next[0] !== position[0] || next[2] !== position[2],
  };
}

function shouldReplaceCanonicalSidecarObject(
  current: UnifiedOfficeModel["officeObjects"][number],
  next: UnifiedOfficeModel["officeObjects"][number],
  canonicalId: string,
): boolean {
  const currentIsCanonical = current.id === canonicalId;
  const nextIsCanonical = next.id === canonicalId;
  if (currentIsCanonical !== nextIsCanonical) return nextIsCanonical;
  return false;
}

function dedupeCanonicalSidecarObjects(
  objects: UnifiedOfficeModel["officeObjects"],
): UnifiedOfficeModel["officeObjects"] {
  const byCanonicalId = new Map<string, UnifiedOfficeModel["officeObjects"][number]>();
  for (const object of objects) {
    const canonicalId = normalizeOfficeObjectId(object.id);
    const existing = byCanonicalId.get(canonicalId);
    if (!existing) {
      byCanonicalId.set(canonicalId, object);
      continue;
    }
    if (shouldReplaceCanonicalSidecarObject(existing, object, canonicalId)) {
      byCanonicalId.set(canonicalId, object);
    }
  }
  return [...byCanonicalId.values()];
}

function resolveTeamClusterTeamId(
  object: UnifiedOfficeModel["officeObjects"][number],
): string | null {
  const metadataTeamId =
    object.metadata && typeof object.metadata.teamId === "string"
      ? object.metadata.teamId.trim()
      : "";
  if (metadataTeamId) return metadataTeamId;
  const candidates = [object.id, object.identifier].filter(
    (value): value is string => typeof value === "string",
  );
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (trimmed.startsWith("cluster-team-")) {
      return trimmed.replace(/^cluster-/, "");
    }
  }
  return null;
}

function buildDefaultFurnitureObjects(companyId: string): OfficeObject[] {
  return [
    { _id: "plant-1", companyId, meshType: "plant", position: [-14, 0, -14], rotation: [0, 0, 0] },
    { _id: "plant-2", companyId, meshType: "plant", position: [14, 0, -14], rotation: [0, 0, 0] },
    {
      _id: "bookshelf-1",
      companyId,
      meshType: "bookshelf",
      position: [0, 0, -15],
      rotation: [0, 0, 0],
    },
    {
      _id: "couch-1",
      companyId,
      meshType: "couch",
      position: [12, 0, -14],
      rotation: [0, Math.PI, 0],
    },
    {
      _id: "pantry-1",
      companyId,
      meshType: "pantry",
      position: [-12, 0, -14],
      rotation: [0, 0, 0],
    },
  ];
}

function fallbackData(): OfficeDataContextType {
  const teamId = "team-openclaw";
  const companyId = demoCompany._id;
  const teams: TeamData[] = [
    {
      _id: teamId,
      companyId,
      name: "OpenClaw Ops",
      description: "Default office cluster",
      deskCount: 3,
      clusterPosition: [0, 0, 8],
      employees: ["employee-main"],
    },
  ];
  const desks: DeskLayoutData[] = [
    { id: "desk-openclaw-0", deskIndex: 0, team: "OpenClaw Ops" },
    { id: "desk-openclaw-1", deskIndex: 1, team: "OpenClaw Ops" },
    { id: "desk-openclaw-2", deskIndex: 2, team: "OpenClaw Ops" },
  ];
  const employees: EmployeeData[] = [
    {
      _id: "employee-main",
      companyId,
      teamId,
      builtInRole: "operator",
      name: "Main Agent",
      team: "OpenClaw Ops",
      initialPosition: [0, 0, 8],
      isBusy: false,
      isCEO: true,
      isSupervisor: false,
      jobTitle: "OpenClaw Operator",
      status: "info",
      statusMessage: "Waiting for OpenClaw adapter data.",
    },
  ];
  const officeObjects: OfficeObject[] = [
    {
      _id: "cluster-openclaw",
      companyId,
      meshType: "team-cluster",
      position: [0, 0, 8],
      rotation: [0, 0, 0],
      metadata: { teamId },
    },
  ];
  return {
    company: demoCompany,
    teams,
    employees,
    officeObjects,
    desks,
    officeSettings: {
      meshAssetDir: "",
      officeFootprint: DEFAULT_OFFICE_FOOTPRINT,
      officeLayout: createRectangularOfficeLayout(DEFAULT_OFFICE_FOOTPRINT),
      decor: {
        floorPatternId: "sandstone_tiles",
        wallColorId: "gallery_cream",
        backgroundId: "shell_haze",
      },
      viewProfile: "free_orbit_3d",
      orbitControlsEnabled: true,
      cameraOrientation: "south_east",
    },
    companyModel: null,
    workload: [],
    warnings: [],
    refresh: async () => {},
    applyOfficeSettings: () => {},
    manualResync: async () => ({ ok: false, error: "adapter_unavailable" }),
    upsertFederationPolicy: async () => ({ ok: false, error: "adapter_unavailable" }),
    upsertProviderIndexProfile: async () => ({ ok: false, error: "adapter_unavailable" }),
    isLoading: false,
  };
}

function areStringArraysEqual(current: string[], next: string[]): boolean {
  if (current.length !== next.length) return false;
  return current.every((value, index) => value === next[index]);
}

function toOfficeData(
  unified: UnifiedOfficeModel,
  officeSettings: OfficeDataContextType["officeSettings"],
  pendingApprovals: PendingApprovalModel[] = [],
  liveStatusByAgent: Record<string, AgentLiveStatus> = {},
): OfficeDataContextType {
  const runtimeAgents = unified.runtimeAgents;
  const configuredAgents = unified.configuredAgents;
  const sidecarObjects = dedupeCanonicalSidecarObjects(unified.officeObjects ?? []);
  const companyModel = unified.company;
  const workload = unified.workload;
  const warnings = unified.warnings;
  const officeLayout = officeSettings.officeLayout;
  const agents: AgentCardModel[] = configuredAgents.length > 0 ? configuredAgents : runtimeAgents;
  if (agents.length === 0) return fallbackData();

  const companyId = demoCompany._id;
  const runtimeById = new Map(runtimeAgents.map((agent) => [agent.agentId, agent]));
  const companyAgentsById = new Map(companyModel.agents.map((agent) => [agent.agentId, agent]));
  const projectToTeamId = new Map<string, string>();
  const teams: TeamData[] = [];
  const projectList = (companyModel.projects ?? []).filter(
    (project) => project.status !== "archived",
  );
  const companyAgents = companyModel.agents ?? [];
  const teamClusterAnchorsByTeamId = new Map<string, [number, number, number]>();
  for (const object of sidecarObjects.filter((entry) => entry.meshType === "team-cluster")) {
    const resolvedTeamId = resolveTeamClusterTeamId(object);
    if (!resolvedTeamId) continue;
    teamClusterAnchorsByTeamId.set(
      resolvedTeamId,
      clampClusterPositionForLayout(object.position, officeLayout).position,
    );
  }
  const ceoAnchor = getManagementAnchorFromOfficeLayout(officeLayout);

  teams.push({
    _id: "team-management",
    companyId,
    name: "Management",
    description: "Executive control desk inside the dedicated management zone.",
    deskCount: 1,
    clusterPosition: ceoAnchor,
    employees: [],
  });

  if (projectList.length > 0) {
    for (const [projectIndex, project] of projectList.entries()) {
      const teamId = `team-${project.id}`;
      projectToTeamId.set(project.id, teamId);
      const projectAgents = companyAgents.filter((agent) => agent.projectId === project.id);
      const summary = workload.find((item) => item.projectId === project.id);
      const revenueCents = (project.ledger ?? [])
        .filter((entry) => entry.type === "revenue")
        .reduce((total, entry) => total + Math.max(0, Math.round(entry.amount)), 0);
      const costCents = (project.ledger ?? [])
        .filter((entry) => entry.type === "cost")
        .reduce((total, entry) => total + Math.max(0, Math.round(entry.amount)), 0);
      const fallbackAnchor: [number, number, number] = [projectIndex * 9 - 4, 0, 8];
      const clusterPosition =
        teamClusterAnchorsByTeamId.get(teamId) ??
        clampClusterPositionForLayout(fallbackAnchor, officeLayout).position;
      const resources = (project.resources ?? []).map((resource) => {
        const softLimit = resource.policy.softLimit;
        const hardLimit = resource.policy.hardLimit;
        const health =
          typeof hardLimit === "number" && resource.remaining <= hardLimit
            ? "depleted"
            : typeof softLimit === "number" && resource.remaining <= softLimit
              ? "warning"
              : "healthy";
        return {
          id: resource.id,
          type: resource.type,
          name: resource.name,
          unit: resource.unit,
          remaining: resource.remaining,
          limit: resource.limit,
          reserved: resource.reserved,
          health,
        };
      });
      const readinessIssues = computeBusinessReadinessIssues(
        projectToBusinessBuilderDraft(project),
      ).map((issue) => issue.message);
      teams.push({
        _id: teamId,
        companyId,
        name: project.name,
        description: `${project.goal} | open=${summary?.openTickets ?? 0} closed=${summary?.closedTickets ?? 0}`,
        deskCount: Math.max(projectAgents.length, 1),
        clusterPosition,
        employees: projectAgents.map((agent) => `employee-${agent.agentId}`),
        businessType: project.businessConfig?.type,
        capabilitySkills: project.businessConfig
          ? {
              measure: project.businessConfig.slots.measure.skillId,
              execute: project.businessConfig.slots.execute.skillId,
              distribute: project.businessConfig.slots.distribute.skillId,
            }
          : undefined,
        finances: {
          revenueCents,
          costCents,
          profitCents: revenueCents - costCents,
        },
        resources,
        businessReadiness: {
          ready: readinessIssues.length === 0,
          issues: readinessIssues,
        },
      });
    }
  } else {
    const teamId = "team-openclaw";
    teams.push({
      _id: teamId,
      companyId,
      name: "OpenClaw Ops",
      description: "Agents discovered from OpenClaw state.",
      deskCount: Math.max(agents.length, 1),
      clusterPosition: [0, 0, 8],
      employees: agents.map((agent) => `employee-${agent.agentId}`),
    });
  }

  const desks: DeskLayoutData[] = teams.flatMap((team) =>
    Array.from(
      {
        length:
          team.name === "Management"
            ? Math.max(team.deskCount ?? 1, 1)
            : Math.max(team.deskCount ?? 0, 1),
      },
      (_, deskIndex) => ({
        id: `desk-${team._id}-${deskIndex}`,
        deskIndex,
        team: team.name,
      }),
    ),
  );

  const normalizedDeskLayoutsByTeamId = new Map<
    string,
    Array<{
      deskId: string;
      layoutIndex: number;
      total: number;
    }>
  >();
  for (const team of teams) {
    const normalizedDesks = desks
      .filter((desk) => desk.id.startsWith(`desk-${team._id}-`))
      .map((desk, originalIndex) => ({
        desk,
        originalIndex,
        persistedIndex: Number.isFinite(desk.deskIndex) ? desk.deskIndex : Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) =>
        a.persistedIndex === b.persistedIndex
          ? a.originalIndex - b.originalIndex
          : a.persistedIndex - b.persistedIndex,
      )
      .map(({ desk }, layoutIndex, ordered) => ({
        deskId: desk.id,
        layoutIndex,
        total: ordered.length,
      }));
    normalizedDeskLayoutsByTeamId.set(team._id, normalizedDesks);
  }
  const teamDeskCursor = new Map<string, number>();

  // Build approval counts per agent for notification badges
  const approvalsByAgent = new Map<string, { count: number; maxRisk: number }>();
  for (const approval of pendingApprovals) {
    const existing = approvalsByAgent.get(approval.agentId) ?? { count: 0, maxRisk: 0 };
    existing.count += 1;
    const riskValue =
      approval.riskLevel === "critical"
        ? 3
        : approval.riskLevel === "high"
          ? 3
          : approval.riskLevel === "medium"
            ? 2
            : 1;
    existing.maxRisk = Math.max(existing.maxRisk, riskValue);
    approvalsByAgent.set(approval.agentId, existing);
  }

  const clusterObjects: OfficeObject[] = teams
    .filter((team) => team.name !== "Management")
    .map((team, index) => ({
      _id: `cluster-${team._id}`,
      companyId,
      meshType: "team-cluster",
      position: team.clusterPosition ?? [index * 9 - 4, 0, 8],
      rotation: [0, 0, 0],
      metadata: { teamId: team._id },
    }));
  const sidecarFurniture: OfficeObject[] = sidecarObjects
    .filter((item) => item.meshType !== "team-cluster")
    .map((item) => ({
      _id: normalizeOfficeObjectId(item.id),
      companyId,
      meshType: item.meshType,
      position: clampPositionToOfficeLayout(item.position, officeLayout, 1),
      rotation: item.rotation ?? [0, 0, 0],
      scale: item.scale,
      metadata: { ...(item.metadata ?? {}) },
    }));
  const officeObjects = [
    ...clusterObjects,
    ...(sidecarFurniture.length > 0 ? sidecarFurniture : buildDefaultFurnitureObjects(companyId)),
  ];
  const skillTargetObjects = buildSkillTargetObjectMap(officeObjects);
  const skillOccupants = new Map<string, string[]>();
  for (const agent of agents) {
    const activeSkillId = liveStatusByAgent[agent.agentId]?.currentSkillId?.trim();
    if (!activeSkillId) continue;
    const occupants = skillOccupants.get(activeSkillId) ?? [];
    occupants.push(agent.agentId);
    skillOccupants.set(activeSkillId, occupants);
  }

  const employees: EmployeeData[] = agents.map((agent, index) => {
    const companyAgent = companyAgentsById.get(agent.agentId);
    const runtimeAgent = runtimeById.get(agent.agentId);
    const isRuntimeRunning = Boolean(runtimeAgent);
    const isMainAgent = agent.agentId === "main";
    const teamId = isMainAgent
      ? "team-management"
      : companyAgent?.projectId
        ? (projectToTeamId.get(companyAgent.projectId) ?? "team-openclaw")
        : "team-openclaw";
    const team = teams.find((item) => item._id === teamId);
    const heartbeat = companyModel.heartbeatProfiles.find(
      (item) => item.id === companyAgent?.heartbeatProfileId,
    );
    const liveStatus = liveStatusByAgent[agent.agentId];
    const activeSkillId = liveStatus?.currentSkillId?.trim();
    const skillOccupantIds = activeSkillId ? (skillOccupants.get(activeSkillId) ?? []) : [];
    const skillOccupantIndex =
      activeSkillId && skillOccupantIds.length > 0 ? skillOccupantIds.indexOf(agent.agentId) : -1;
    const skillTargetObject = activeSkillId ? skillTargetObjects.get(activeSkillId) : undefined;
    const pressure = companyAgent?.projectId
      ? workload.find((item) => item.projectId === companyAgent.projectId)?.queuePressure
      : undefined;
    const teamCenter = team?.clusterPosition ?? [0, 0, 8];
    const teamDeskLayouts = team ? (normalizedDeskLayoutsByTeamId.get(team._id) ?? []) : [];
    const currentDeskCursor = teamDeskCursor.get(teamId) ?? 0;
    const initialDeskLayout =
      teamDeskLayouts.length > 0
        ? teamDeskLayouts[Math.min(currentDeskCursor, teamDeskLayouts.length - 1)]
        : null;
    if (teamDeskLayouts.length > 0) {
      teamDeskCursor.set(teamId, currentDeskCursor + 1);
    }
    const deskPosition = initialDeskLayout
      ? getAbsoluteDeskPosition(teamCenter, initialDeskLayout.layoutIndex, initialDeskLayout.total)
      : null;
    const deskRotation = initialDeskLayout
      ? getDeskRotation(initialDeskLayout.layoutIndex, initialDeskLayout.total)
      : null;
    const initialPosition: [number, number, number] =
      isMainAgent && initialDeskLayout == null
        ? ceoAnchor
        : deskPosition && deskRotation != null
          ? getEmployeePositionAtDesk(deskPosition, deskRotation)
          : teamCenter;
    const agentApprovals = approvalsByAgent.get(agent.agentId);
    const heartbeatStatus =
      liveStatus?.state === "error"
        ? "warning"
        : liveStatus?.state === "blocked"
          ? "warning"
          : liveStatus?.state === "done"
            ? "success"
            : liveStatus?.state === "ok"
              ? "success"
              : liveStatus?.state === "running"
                ? "info"
                : liveStatus?.state === "planning" || liveStatus?.state === "executing"
                  ? "info"
                  : liveStatus?.state === "no_work"
                    ? "info"
                    : undefined;
    return {
      _id: `employee-${agent.agentId}`,
      companyId,
      teamId,
      builtInRole: companyAgent?.role ?? "worker",
      name: agent.displayName,
      team: team?.name ?? "OpenClaw Ops",
      initialPosition,
      activityTargetPosition:
        skillTargetObject && skillOccupantIndex >= 0
          ? getOfficeSkillAnchorPositionForOccupant(
              skillTargetObject,
              skillOccupantIndex,
              skillOccupantIds.length,
            )
          : undefined,
      activityTargetSkillId: activeSkillId,
      isBusy: (runtimeAgent?.sessionCount ?? 0) > 0,
      deskId: initialDeskLayout?.deskId as EmployeeData["deskId"],
      isCEO: companyAgent?.role === "ceo" || isMainAgent || index === 0,
      isSupervisor:
        companyAgent?.role === "pm" ||
        companyAgent?.role === "biz_pm" ||
        companyAgent?.role === "ceo" ||
        isMainAgent ||
        index === 0,
      jobTitle: companyAgent?.role
        ? `${companyAgent.role} (${agent.agentId})`
        : `Configured Agent (${agent.agentId})`,
      status:
        heartbeatStatus ??
        (!isRuntimeRunning
          ? "warning"
          : pressure === "high"
            ? "warning"
            : (runtimeAgent?.sessionCount ?? 0) > 0
              ? "success"
              : "info"),
      statusMessage: liveStatus?.statusText ?? heartbeat?.goal ?? "Idle",
      notificationCount: agentApprovals?.count,
      notificationPriority: agentApprovals?.maxRisk,
      heartbeatState: liveStatus?.state,
      heartbeatBubbles:
        liveStatus?.bubbles?.map((bubble) => ({ label: bubble.label, weight: bubble.weight })) ??
        [],
    };
  });

  return {
    company: demoCompany,
    teams,
    employees,
    officeObjects,
    desks,
    officeSettings,
    companyModel: unified.company,
    workload,
    warnings,
    refresh: async () => {},
    manualResync: async () => ({ ok: false, error: "adapter_unavailable" }),
    upsertFederationPolicy: async () => ({ ok: false, error: "adapter_unavailable" }),
    upsertProviderIndexProfile: async () => ({ ok: false, error: "adapter_unavailable" }),
    isLoading: false,
  };
}

export function OfficeDataProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const sharedAdapter = useOpenClawAdapter();
  const [value, setValue] = useState<OfficeDataContextType>({ ...fallbackData(), isLoading: true });
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const adapterRef = useRef<OpenClawAdapter | null>(null);
  const cancelledRef = useRef(false);
  const latestUnifiedRef = useRef<UnifiedOfficeModel | null>(null);
  const latestApprovalsRef = useRef<PendingApprovalModel[]>([]);
  const latestLiveStatusSignatureRef = useRef("");
  const liveStatusByConvex = useAgentLiveStatuses(agentIds);

  const applyOfficeSettingsValue = useMemo(
    () => (settings: OfficeSettingsModel) => {
      const unified = latestUnifiedRef.current;
      if (!unified) {
        setValue((current) => ({ ...current, officeSettings: settings }));
        return;
      }
      const pendingApprovals = latestApprovalsRef.current;
      const statusByAgent =
        liveStatusByConvex && Object.keys(liveStatusByConvex).length > 0 ? liveStatusByConvex : {};
      setValue((current) => {
        const next = stabilizeOfficeData(
          current,
          toOfficeData(unified, settings, pendingApprovals, statusByAgent),
        );
        if (next === current) return current;
        return {
          ...next,
          refresh: current.refresh,
          applyOfficeSettings: current.applyOfficeSettings,
          manualResync: current.manualResync,
          upsertFederationPolicy: current.upsertFederationPolicy,
          upsertProviderIndexProfile: current.upsertProviderIndexProfile,
        };
      });
    },
    [liveStatusByConvex],
  );

  const load = React.useCallback(async (): Promise<void> => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    try {
      const [unified, pendingApprovals, officeSettings] = await Promise.all([
        adapter.getUnifiedOfficeModel(),
        adapter.getPendingApprovals(),
        adapter.getOfficeSettings(),
      ]);
      const nextAgentIds = [
        ...new Set([
          ...unified.runtimeAgents.map((item) => item.agentId),
          ...unified.configuredAgents.map((item) => item.agentId),
        ]),
      ];
      setAgentIds((current) =>
        areStringArraysEqual(current, nextAgentIds) ? current : nextAgentIds,
      );

      let statusByAgent: Record<string, AgentLiveStatus> = {};
      if (liveStatusByConvex && Object.keys(liveStatusByConvex).length > 0) {
        statusByAgent = liveStatusByConvex;
      } else {
        statusByAgent = await adapter.getAgentsLiveStatus(nextAgentIds);
      }
      latestLiveStatusSignatureRef.current = JSON.stringify(statusByAgent);

      latestUnifiedRef.current = unified;
      latestApprovalsRef.current = pendingApprovals;
      if (cancelledRef.current) return;
      setValue((current) => {
        const next = stabilizeOfficeData(
          current,
          toOfficeData(unified, officeSettings, pendingApprovals, statusByAgent),
        );
        // Returning the same object lets React skip a provider broadcast for status refreshes that changed nothing material.
        if (next === current) return current;
        return {
          ...next,
          refresh: current.refresh,
          applyOfficeSettings: current.applyOfficeSettings,
          manualResync: current.manualResync,
          upsertFederationPolicy: current.upsertFederationPolicy,
          upsertProviderIndexProfile: current.upsertProviderIndexProfile,
        };
      });
    } catch {
      if (cancelledRef.current) return;
      setValue((current) => ({
        ...fallbackData(),
        refresh: current.refresh,
        applyOfficeSettings: current.applyOfficeSettings,
        manualResync: current.manualResync,
        upsertFederationPolicy: current.upsertFederationPolicy,
        upsertProviderIndexProfile: current.upsertProviderIndexProfile,
      }));
    }
  }, [liveStatusByConvex]);

  useEffect(() => {
    if (!liveStatusByConvex || Object.keys(liveStatusByConvex).length === 0) return;
    const nextStatusSignature = JSON.stringify(liveStatusByConvex);
    if (latestLiveStatusSignatureRef.current === nextStatusSignature) return;
    const unified = latestUnifiedRef.current;
    if (!unified) return;
    const pendingApprovals = latestApprovalsRef.current;
    latestLiveStatusSignatureRef.current = nextStatusSignature;
    setValue((current) => {
      const next = stabilizeOfficeData(
        current,
        toOfficeData(unified, current.officeSettings, pendingApprovals, liveStatusByConvex),
      );
      // Keep live-status polling from invalidating the whole office tree when derived data is unchanged.
      if (next === current) return current;
      return {
        ...next,
        refresh: current.refresh,
        applyOfficeSettings: current.applyOfficeSettings,
        manualResync: current.manualResync,
        upsertFederationPolicy: current.upsertFederationPolicy,
        upsertProviderIndexProfile: current.upsertProviderIndexProfile,
      };
    });
  }, [liveStatusByConvex]);

  useEffect(() => {
    adapterRef.current = sharedAdapter;
    cancelledRef.current = false;

    async function refresh(): Promise<void> {
      await load();
    }

    async function manualResync(
      projectId: string,
      provider?: FederatedTaskProvider,
    ): Promise<{ ok: boolean; error?: string }> {
      const adapter = adapterRef.current;
      if (!adapter) return { ok: false, error: "adapter_unavailable" };
      const result = await adapter.manualResync(projectId, provider);
      await load();
      return result;
    }

    async function upsertFederationPolicy(
      policy: FederationProjectPolicy,
    ): Promise<{ ok: boolean; error?: string }> {
      const adapter = adapterRef.current;
      if (!adapter) return { ok: false, error: "adapter_unavailable" };
      const result = await adapter.upsertFederationPolicy(policy);
      await load();
      return { ok: result.ok, error: result.error };
    }

    async function upsertProviderIndexProfile(
      profile: ProviderIndexProfile,
    ): Promise<{ ok: boolean; error?: string }> {
      const adapter = adapterRef.current;
      if (!adapter) return { ok: false, error: "adapter_unavailable" };
      const result = await adapter.upsertProviderIndexProfile(profile);
      await load();
      return { ok: result.ok, error: result.error };
    }

    setValue((current) => ({
      ...current,
      refresh,
      applyOfficeSettings: applyOfficeSettingsValue,
      manualResync,
      upsertFederationPolicy,
      upsertProviderIndexProfile,
      isLoading: true,
    }));
    void load();
    const timer = setInterval(() => {
      void load();
    }, 15000);

    return () => {
      cancelledRef.current = true;
      clearInterval(timer);
    };
  }, [applyOfficeSettingsValue, load, sharedAdapter]);

  const memoizedValue = useMemo(() => value, [value]);

  return <OfficeDataContext.Provider value={memoizedValue}>{children}</OfficeDataContext.Provider>;
}

export function useOfficeDataContext(): OfficeDataContextType {
  const context = useContext(OfficeDataContext);
  if (!context) {
    throw new Error("useOfficeDataContext must be used within OfficeDataProvider");
  }
  return context;
}
