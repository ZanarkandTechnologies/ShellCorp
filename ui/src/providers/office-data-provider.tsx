"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { OpenClawAdapter } from "@/lib/openclaw-adapter";
import type { Company, DeskLayoutData, EmployeeData, OfficeObject, TeamData } from "@/lib/types";
import type { CompanyModel, ProjectWorkloadSummary, ReconciliationWarning } from "@/lib/openclaw-types";

interface OfficeDataContextType {
  company: Company | null;
  teams: TeamData[];
  employees: EmployeeData[];
  officeObjects: OfficeObject[];
  desks: DeskLayoutData[];
  companyModel: CompanyModel | null;
  workload: ProjectWorkloadSummary[];
  warnings: ReconciliationWarning[];
  isLoading: boolean;
}

const OfficeDataContext = createContext<OfficeDataContextType | undefined>(undefined);

const gatewayBase = import.meta.env.VITE_GATEWAY_URL || "http://127.0.0.1:8787";

const demoCompany: Company = { _id: "company-demo", name: "Shell Company" };

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
    isLoading: false,
  };
}

function toOfficeData(agents: Array<{
  agentId: string;
  displayName: string;
  sandboxMode: string;
  sessionCount: number;
}>, companyModel: CompanyModel | null, workload: ProjectWorkloadSummary[], warnings: ReconciliationWarning[]): OfficeDataContextType {
  if (agents.length === 0) return fallbackData();

  const companyId = demoCompany._id;
  const projectToTeamId = new Map<string, string>();
  const teams: TeamData[] = [];
  const projectList = companyModel?.projects ?? [];
  const activeCompanyAgents = companyModel?.agents ?? [];

  if (projectList.length > 0) {
    for (const project of projectList) {
      const teamId = `team-${project.id}`;
      projectToTeamId.set(project.id, teamId);
      const projectAgents = activeCompanyAgents.filter((agent) => agent.projectId === project.id);
      const summary = workload.find((item) => item.projectId === project.id);
      teams.push({
        _id: teamId,
        companyId,
        name: project.name,
        description: `${project.goal} | open=${summary?.openTickets ?? 0} closed=${summary?.closedTickets ?? 0}`,
        deskCount: Math.max(projectAgents.length, 3),
        clusterPosition: [teams.length * 9 - 4, 0, 8],
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
    Array.from({ length: Math.max(team.deskCount ?? 0, 3) }, (_, deskIndex) => ({
      id: `desk-${team._id}-${deskIndex}`,
      deskIndex,
      team: team.name,
    })),
  );

  const employees: EmployeeData[] = agents.map((agent, index) => {
    const companyAgent = activeCompanyAgents.find((item) => item.agentId === agent.agentId);
    const teamId = companyAgent?.projectId ? projectToTeamId.get(companyAgent.projectId) ?? "team-openclaw" : "team-openclaw";
    const team = teams.find((item) => item._id === teamId);
    const heartbeat = companyModel?.heartbeatProfiles.find((item) => item.id === companyAgent?.heartbeatProfileId);
    const pressure = companyAgent?.projectId ? workload.find((item) => item.projectId === companyAgent.projectId)?.queuePressure : undefined;
    const angle = (index / Math.max(agents.length, 1)) * Math.PI * 2;
    const radius = 3 + Math.floor(index / 4);
    return {
      _id: `employee-${agent.agentId}`,
      companyId,
      teamId,
      builtInRole: companyAgent?.role ?? "worker",
      name: agent.displayName,
      team: team?.name ?? "OpenClaw Ops",
      initialPosition: [Math.cos(angle) * radius, 0, 8 + Math.sin(angle) * radius],
      isBusy: agent.sessionCount > 0,
      isCEO: companyAgent?.role === "ceo" || index === 0,
      isSupervisor: companyAgent?.role === "pm" || companyAgent?.role === "ceo" || index === 0,
      jobTitle: companyAgent?.role ? `${companyAgent.role} (${agent.agentId})` : `Agent (${agent.agentId})`,
      status: pressure === "high" ? "warning" : agent.sessionCount > 0 ? "success" : "info",
      statusMessage: `${heartbeat?.goal ?? "No heartbeat profile"} | sandbox=${agent.sandboxMode} | sessions=${agent.sessionCount}`,
    };
  });

  const officeObjects: OfficeObject[] = teams.map((team, index) => ({
    _id: `cluster-${team._id}`,
    companyId,
    meshType: "team-cluster",
    position: [index * 9 - 4, 0, 8],
    rotation: [0, 0, 0],
    metadata: { teamId: team._id },
  }));

  return {
    company: demoCompany,
    teams,
    employees,
    officeObjects,
    desks,
    companyModel,
    workload,
    warnings,
    isLoading: false,
  };
}

export function OfficeDataProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [value, setValue] = useState<OfficeDataContextType>({ ...fallbackData(), isLoading: true });

  useEffect(() => {
    const adapter = new OpenClawAdapter(gatewayBase);
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const unified = await adapter.getUnifiedOfficeModel();
        if (cancelled) return;
        setValue(toOfficeData(unified.runtimeAgents, unified.company, unified.workload, unified.warnings));
      } catch {
        if (cancelled) return;
        setValue(fallbackData());
      }
    }

    void load();
    const timer = setInterval(() => {
      void load();
    }, 15000);

    return () => {
      cancelled = true;
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
