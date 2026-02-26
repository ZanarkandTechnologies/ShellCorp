"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { HALF_FLOOR } from "@/constants";
import { getAbsoluteDeskPosition, getDeskRotation, getEmployeePositionAtDesk } from "@/convex/utils/layout";
import { normalizeOfficeObjectId } from "@/features/office-system/components/office-object-id";
import { gatewayBase, stateBase } from "@/lib/gateway-config";
import { OpenClawAdapter } from "@/lib/openclaw-adapter";
import type { Company, DeskLayoutData, EmployeeData, OfficeObject, TeamData } from "@/lib/types";
import type {
  AgentCardModel,
  CompanyModel,
  FederatedTaskProvider,
  FederationProjectPolicy,
  ProviderIndexProfile,
  ProjectWorkloadSummary,
  ReconciliationWarning,
  UnifiedOfficeModel,
} from "@/lib/openclaw-types";

interface OfficeDataContextType {
  company: Company | null;
  teams: TeamData[];
  employees: EmployeeData[];
  officeObjects: OfficeObject[];
  desks: DeskLayoutData[];
  companyModel: CompanyModel | null;
  workload: ProjectWorkloadSummary[];
  warnings: ReconciliationWarning[];
  refresh: () => Promise<void>;
  manualResync: (projectId: string, provider?: FederatedTaskProvider) => Promise<{ ok: boolean; error?: string }>;
  upsertFederationPolicy: (policy: FederationProjectPolicy) => Promise<{ ok: boolean; error?: string }>;
  upsertProviderIndexProfile: (profile: ProviderIndexProfile) => Promise<{ ok: boolean; error?: string }>;
  bootstrapNotionProfile: (projectId: string, databaseId: string, toolNamingPrefix?: string) => Promise<{ ok: boolean; error?: string }>;
  isLoading: boolean;
}

const OfficeDataContext = createContext<OfficeDataContextType | undefined>(undefined);
const CLUSTER_MARGIN = 2;

const demoCompany: Company = { _id: "company-demo", name: "Shell Company" };

function clampClusterPosition(position: [number, number, number]): { position: [number, number, number]; clamped: boolean } {
  const limit = HALF_FLOOR - CLUSTER_MARGIN;
  const clampedX = Math.max(-limit, Math.min(limit, position[0]));
  const clampedZ = Math.max(-limit, Math.min(limit, position[2]));
  const didClamp = clampedX !== position[0] || clampedZ !== position[2];
  return { position: [clampedX, position[1], clampedZ], clamped: didClamp };
}

function deriveCeoAnchor(objects: UnifiedOfficeModel["officeObjects"]): [number, number, number] {
  const glassWalls = objects.filter((object) => object.meshType === "glass-wall");
  if (glassWalls.length === 0) return [0, 0, 15];
  const avgX = glassWalls.reduce((sum, object) => sum + object.position[0], 0) / glassWalls.length;
  const maxZ = glassWalls.reduce((max, object) => Math.max(max, object.position[2]), -Infinity);
  const anchored: [number, number, number] = [avgX, 0, Number.isFinite(maxZ) ? maxZ : 15];
  return clampClusterPosition(anchored).position;
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

function resolveTeamClusterTeamId(object: UnifiedOfficeModel["officeObjects"][number]): string | null {
  const metadataTeamId = object.metadata && typeof object.metadata.teamId === "string" ? object.metadata.teamId.trim() : "";
  if (metadataTeamId) return metadataTeamId;
  const candidates = [object.id, object.identifier].filter((value): value is string => typeof value === "string");
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
    { _id: "bookshelf-1", companyId, meshType: "bookshelf", position: [0, 0, -15], rotation: [0, 0, 0] },
    { _id: "couch-1", companyId, meshType: "couch", position: [12, 0, -14], rotation: [0, Math.PI, 0] },
    { _id: "pantry-1", companyId, meshType: "pantry", position: [-12, 0, -14], rotation: [0, 0, 0] },
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
    companyModel: null,
    workload: [],
    warnings: [],
    refresh: async () => {},
    manualResync: async () => ({ ok: false, error: "adapter_unavailable" }),
    upsertFederationPolicy: async () => ({ ok: false, error: "adapter_unavailable" }),
    upsertProviderIndexProfile: async () => ({ ok: false, error: "adapter_unavailable" }),
    bootstrapNotionProfile: async () => ({ ok: false, error: "adapter_unavailable" }),
    isLoading: false,
  };
}

function toOfficeData(unified: UnifiedOfficeModel): OfficeDataContextType {
  const runtimeAgents = unified.runtimeAgents;
  const configuredAgents = unified.configuredAgents;
  const sidecarObjects = dedupeCanonicalSidecarObjects(unified.officeObjects ?? []);
  const companyModel = unified.company;
  const workload = unified.workload;
  const warnings = unified.warnings;
  const agents: AgentCardModel[] = configuredAgents.length > 0 ? configuredAgents : runtimeAgents;
  if (agents.length === 0) return fallbackData();

  const companyId = demoCompany._id;
  const runtimeById = new Map(runtimeAgents.map((agent) => [agent.agentId, agent]));
  const companyAgentsById = new Map(companyModel.agents.map((agent) => [agent.agentId, agent]));
  const projectToTeamId = new Map<string, string>();
  const teams: TeamData[] = [];
  const projectList = companyModel.projects ?? [];
  const companyAgents = companyModel.agents ?? [];
  const teamClusterAnchorsByTeamId = new Map<string, [number, number, number]>();
  for (const object of sidecarObjects.filter((entry) => entry.meshType === "team-cluster")) {
    const resolvedTeamId = resolveTeamClusterTeamId(object);
    if (!resolvedTeamId) continue;
    teamClusterAnchorsByTeamId.set(resolvedTeamId, clampClusterPosition(object.position).position);
  }
  const ceoAnchor = deriveCeoAnchor(sidecarObjects);

  teams.push({
    _id: "team-management",
    companyId,
    name: "Management",
    description: "Executive control desk inside the glass panel zone.",
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
      const fallbackAnchor: [number, number, number] = [projectIndex * 9 - 4, 0, 8];
      const clusterPosition = teamClusterAnchorsByTeamId.get(teamId) ?? clampClusterPosition(fallbackAnchor).position;
      teams.push({
        _id: teamId,
        companyId,
        name: project.name,
        description: `${project.goal} | open=${summary?.openTickets ?? 0} closed=${summary?.closedTickets ?? 0}`,
        deskCount: Math.max(projectAgents.length, 3),
        clusterPosition,
        employees: projectAgents.map((agent) => `employee-${agent.agentId}`),
      });
    }
  } else {
    const teamId = "team-openclaw";
    teams.push({
      _id: teamId,
      companyId,
      name: "OpenClaw Ops",
      description: "Agents discovered from OpenClaw state.",
      deskCount: Math.max(agents.length, 3),
      clusterPosition: [0, 0, 8],
      employees: agents.map((agent) => `employee-${agent.agentId}`),
    });
  }

  const desks: DeskLayoutData[] = teams.flatMap((team) =>
    Array.from({ length: team.name === "Management" ? Math.max(team.deskCount ?? 1, 1) : Math.max(team.deskCount ?? 0, 3) }, (_, deskIndex) => ({
      id: `desk-${team._id}-${deskIndex}`,
      deskIndex,
      team: team.name,
    })),
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
      .filter((desk) => desk.team === team.name)
      .map((desk, originalIndex) => ({
        desk,
        originalIndex,
        persistedIndex: Number.isFinite(desk.deskIndex) ? desk.deskIndex : Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) =>
        a.persistedIndex === b.persistedIndex ? a.originalIndex - b.originalIndex : a.persistedIndex - b.persistedIndex,
      )
      .map(({ desk }, layoutIndex, ordered) => ({
        deskId: desk.id,
        layoutIndex,
        total: ordered.length,
      }));
    normalizedDeskLayoutsByTeamId.set(team._id, normalizedDesks);
  }
  const teamDeskCursor = new Map<string, number>();

  const employees: EmployeeData[] = agents.map((agent, index) => {
    const companyAgent = companyAgentsById.get(agent.agentId);
    const runtimeAgent = runtimeById.get(agent.agentId);
    const isRuntimeRunning = Boolean(runtimeAgent);
    const isMainAgent = agent.agentId === "main";
    const teamId = isMainAgent
      ? "team-management"
      : companyAgent?.projectId
        ? projectToTeamId.get(companyAgent.projectId) ?? "team-openclaw"
        : "team-openclaw";
    const team = teams.find((item) => item._id === teamId);
    const heartbeat = companyModel.heartbeatProfiles.find((item) => item.id === companyAgent?.heartbeatProfileId);
    const pressure = companyAgent?.projectId ? workload.find((item) => item.projectId === companyAgent.projectId)?.queuePressure : undefined;
    const teamCenter = team?.clusterPosition ?? [0, 0, 8];
    const teamDeskLayouts = team ? normalizedDeskLayoutsByTeamId.get(team._id) ?? [] : [];
    const currentDeskCursor = teamDeskCursor.get(teamId) ?? 0;
    const initialDeskLayout =
      teamDeskLayouts.length > 0 ? teamDeskLayouts[Math.min(currentDeskCursor, teamDeskLayouts.length - 1)] : null;
    if (teamDeskLayouts.length > 0) {
      teamDeskCursor.set(teamId, currentDeskCursor + 1);
    }
    const deskPosition = initialDeskLayout
      ? getAbsoluteDeskPosition(teamCenter, initialDeskLayout.layoutIndex, initialDeskLayout.total)
      : null;
    const deskRotation = initialDeskLayout ? getDeskRotation(initialDeskLayout.layoutIndex, initialDeskLayout.total) : null;
    const initialPosition: [number, number, number] = isMainAgent && initialDeskLayout == null
      ? ceoAnchor
      : deskPosition && deskRotation != null
        ? getEmployeePositionAtDesk(deskPosition, deskRotation)
        : teamCenter;
    return {
      _id: `employee-${agent.agentId}`,
      companyId,
      teamId,
      builtInRole: companyAgent?.role ?? "worker",
      name: agent.displayName,
      team: team?.name ?? "OpenClaw Ops",
      initialPosition,
      isBusy: (runtimeAgent?.sessionCount ?? 0) > 0,
      deskId: initialDeskLayout?.deskId as EmployeeData["deskId"],
      isCEO: companyAgent?.role === "ceo" || isMainAgent || index === 0,
      isSupervisor: companyAgent?.role === "pm" || companyAgent?.role === "ceo" || isMainAgent || index === 0,
      jobTitle: companyAgent?.role ? `${companyAgent.role} (${agent.agentId})` : `Configured Agent (${agent.agentId})`,
      status: !isRuntimeRunning ? "warning" : pressure === "high" ? "warning" : (runtimeAgent?.sessionCount ?? 0) > 0 ? "success" : "info",
      statusMessage: `${heartbeat?.goal ?? "No heartbeat profile"} | runtime=${isRuntimeRunning ? "running" : "not-running"} | sandbox=${agent.sandboxMode} | sessions=${runtimeAgent?.sessionCount ?? 0}`,
    };
  });

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
      position: item.position,
      rotation: item.rotation ?? [0, 0, 0],
      metadata: { ...(item.metadata ?? {}) },
    }));
  const officeObjects = [...clusterObjects, ...(sidecarFurniture.length > 0 ? sidecarFurniture : buildDefaultFurnitureObjects(companyId))];

  return {
    company: demoCompany,
    teams,
    employees,
    officeObjects,
    desks,
    companyModel: unified.company,
    workload,
    warnings,
    refresh: async () => {},
    manualResync: async () => ({ ok: false, error: "adapter_unavailable" }),
    upsertFederationPolicy: async () => ({ ok: false, error: "adapter_unavailable" }),
    upsertProviderIndexProfile: async () => ({ ok: false, error: "adapter_unavailable" }),
    bootstrapNotionProfile: async () => ({ ok: false, error: "adapter_unavailable" }),
    isLoading: false,
  };
}

export function OfficeDataProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [value, setValue] = useState<OfficeDataContextType>({ ...fallbackData(), isLoading: true });
  const adapterRef = useRef<OpenClawAdapter | null>(null);
  const cancelledRef = useRef(false);

  const load = async (): Promise<void> => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    try {
      const unified = await adapter.getUnifiedOfficeModel();
      if (cancelledRef.current) return;
      setValue((current) => {
        const next = toOfficeData(unified);
        return {
          ...next,
          refresh: current.refresh,
          manualResync: current.manualResync,
          upsertFederationPolicy: current.upsertFederationPolicy,
          upsertProviderIndexProfile: current.upsertProviderIndexProfile,
          bootstrapNotionProfile: current.bootstrapNotionProfile,
        };
      });
    } catch {
      if (cancelledRef.current) return;
      setValue((current) => ({
        ...fallbackData(),
        refresh: current.refresh,
        manualResync: current.manualResync,
        upsertFederationPolicy: current.upsertFederationPolicy,
        upsertProviderIndexProfile: current.upsertProviderIndexProfile,
        bootstrapNotionProfile: current.bootstrapNotionProfile,
      }));
    }
  };

  useEffect(() => {
    adapterRef.current = new OpenClawAdapter(gatewayBase, stateBase);
    cancelledRef.current = false;

    async function refresh(): Promise<void> {
      await load();
    }

    async function manualResync(projectId: string, provider?: FederatedTaskProvider): Promise<{ ok: boolean; error?: string }> {
      const adapter = adapterRef.current;
      if (!adapter) return { ok: false, error: "adapter_unavailable" };
      const result = await adapter.manualResync(projectId, provider);
      await load();
      return result;
    }

    async function upsertFederationPolicy(policy: FederationProjectPolicy): Promise<{ ok: boolean; error?: string }> {
      const adapter = adapterRef.current;
      if (!adapter) return { ok: false, error: "adapter_unavailable" };
      const result = await adapter.upsertFederationPolicy(policy);
      await load();
      return { ok: result.ok, error: result.error };
    }

    async function upsertProviderIndexProfile(profile: ProviderIndexProfile): Promise<{ ok: boolean; error?: string }> {
      const adapter = adapterRef.current;
      if (!adapter) return { ok: false, error: "adapter_unavailable" };
      const result = await adapter.upsertProviderIndexProfile(profile);
      await load();
      return { ok: result.ok, error: result.error };
    }

    async function bootstrapNotionProfile(
      projectId: string,
      databaseId: string,
      toolNamingPrefix?: string,
    ): Promise<{ ok: boolean; error?: string }> {
      const adapter = adapterRef.current;
      if (!adapter) return { ok: false, error: "adapter_unavailable" };
      const bootstrapped = await adapter.bootstrapNotionProfile(databaseId);
      if (!bootstrapped.ok || !bootstrapped.profile) return { ok: false, error: bootstrapped.error };
      const upsertResult = await adapter.upsertProviderIndexProfile({
        ...bootstrapped.profile,
        profileId: `${projectId}:notion:${bootstrapped.profile.entityId}`,
        projectId,
        toolNamingPrefix: toolNamingPrefix?.trim() ? toolNamingPrefix.trim() : bootstrapped.profile.toolNamingPrefix,
        updatedAt: Date.now(),
      });
      await load();
      return { ok: upsertResult.ok, error: upsertResult.error };
    }

    setValue((current) => ({
      ...current,
      refresh,
      manualResync,
      upsertFederationPolicy,
      upsertProviderIndexProfile,
      bootstrapNotionProfile,
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
  }, []);

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
