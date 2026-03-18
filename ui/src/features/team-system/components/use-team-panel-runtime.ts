"use client";

/**
 * TEAM PANEL RUNTIME STATE
 * ========================
 * Purpose
 * - Isolate async runtime reads used by Team Panel overview, timeline, and business surfaces.
 *
 * KEY CONCEPTS:
 * - Runtime skill configuration comes from OpenClaw config snapshots.
 * - Recent usage summary is derived from agent session timelines, not stored in the panel shell.
 *
 * USAGE:
 * - Call from TeamPanel with the resolved team roster and communication/task rows.
 *
 * MEMORY REFERENCES:
 * - MEM-0196
 * - MEM-0205
 */

import { useEffect, useMemo, useState } from "react";
import type { SessionTimelineModel } from "@/lib/openclaw-types";
import { buildTeamAiUsageSummary } from "@/lib/session-usage";
import type { OpenClawAdapter } from "@/lib/openclaw-adapter";
import {
  deriveAgentPresenceRows,
  type AgentCandidate,
  type AgentPresenceRow,
  type CommunicationRow,
  type PanelTask,
  type PresenceEmployee,
} from "./team-panel-types";

type EmployeeLike = PresenceEmployee & {
  teamId?: string | null;
  builtInRole?: string | null;
  heartbeatState?: string | null;
};

interface UseTeamPanelRuntimeStateInput {
  adapter: OpenClawAdapter;
  isOpen: boolean;
  employees: EmployeeLike[];
  teamEmployees: EmployeeLike[];
  visibleRoster: EmployeeLike[];
  usageEmployees: EmployeeLike[];
  globalMode: boolean;
  communicationRows: CommunicationRow[];
  projectTasks: PanelTask[];
}

type UsageRow = {
  agentId: string;
  occurredAt?: number;
  usageSummary?: SessionTimelineModel["usageSummary"];
};

export function useTeamPanelRuntimeState({
  adapter,
  isOpen,
  employees,
  teamEmployees,
  visibleRoster,
  usageEmployees,
  globalMode,
  communicationRows,
  projectTasks,
}: UseTeamPanelRuntimeStateInput): {
  ownerLabelById: Map<string, string>;
  activityFeedCandidates: AgentCandidate[];
  businessSkillRows: Array<{
    agentId: string;
    name: string;
    role: string;
    statusText: string;
    heartbeatState?: string;
    equippedSkills: string[];
  }>;
  presenceRows: AgentPresenceRow[];
  teamAiUsageSummary: ReturnType<typeof buildTeamAiUsageSummary>;
  teamUsageError: string | null;
} {
  const [agentConfiguredSkills, setAgentConfiguredSkills] = useState<Record<string, string[]>>({});
  const [teamUsageRows, setTeamUsageRows] = useState<UsageRow[]>([]);
  const [teamUsageError, setTeamUsageError] = useState<string | null>(null);

  const presenceRows = useMemo(
    (): AgentPresenceRow[] =>
      deriveAgentPresenceRows({
        employees: visibleRoster,
        projectTasks,
        communicationRows,
      }),
    [communicationRows, projectTasks, visibleRoster],
  );

  const activityFeedCandidates = useMemo((): AgentCandidate[] => {
    const roster = globalMode ? employees : teamEmployees;
    return roster
      .map((employee) => {
        const raw = String(employee._id ?? "");
        const agentId = raw.startsWith("employee-") ? raw.slice("employee-".length) : raw;
        return { agentId: agentId.trim(), name: employee.name };
      })
      .filter((entry) => entry.agentId.length > 0);
  }, [employees, globalMode, teamEmployees]);

  const ownerLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const employee of globalMode ? employees : teamEmployees) {
      map.set(employee._id, employee.name);
      if (employee._id.startsWith("employee-")) {
        map.set(employee._id.replace(/^employee-/, ""), employee.name);
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
            role: employee.builtInRole ?? "operator",
            statusText: employee.statusMessage ?? "Idle",
            heartbeatState: employee.heartbeatState ?? undefined,
            equippedSkills: agentConfiguredSkills[agentId] ?? [],
          };
        }),
    [agentConfiguredSkills, teamEmployees],
  );

  const teamAiUsageSummary = useMemo(() => buildTeamAiUsageSummary(teamUsageRows), [teamUsageRows]);

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
  }, [adapter, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setTeamUsageRows([]);
      setTeamUsageError(null);
      return;
    }
    const agentIds = usageEmployees
      .map((employee) => {
        const rawId = String(employee._id ?? "");
        return rawId.startsWith("employee-") ? rawId.replace(/^employee-/, "") : rawId;
      })
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    if (agentIds.length === 0) {
      setTeamUsageRows([]);
      setTeamUsageError(null);
      return;
    }
    let cancelled = false;
    async function loadTeamUsageRows(): Promise<void> {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      let failedAgentCount = 0;
      const rows = await Promise.all(
        agentIds.map(async (agentId) => {
          try {
            const sessions = await adapter.listSessions(agentId);
            const recentSessions = sessions
              .filter((session) => (session.updatedAt ?? 0) >= weekAgo)
              .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
            const timelines = await Promise.all(
              recentSessions.map(async (session) => {
                const timeline = await adapter.getSessionTimeline(agentId, session.sessionKey, 120);
                return {
                  agentId,
                  occurredAt: timeline.usageSummary?.lastResponse?.timestamp ?? session.updatedAt,
                  usageSummary: timeline.usageSummary,
                };
              }),
            );
            return timelines.filter((timeline) => timeline.usageSummary);
          } catch {
            failedAgentCount += 1;
            return [];
          }
        }),
      );
      if (!cancelled) {
        setTeamUsageRows(rows.flat());
        setTeamUsageError(
          failedAgentCount > 0 ? `usage unavailable for ${failedAgentCount} agent(s)` : null,
        );
      }
    }
    void loadTeamUsageRows();
    return () => {
      cancelled = true;
    };
  }, [adapter, isOpen, usageEmployees]);

  return {
    ownerLabelById,
    activityFeedCandidates,
    businessSkillRows,
    presenceRows,
    teamAiUsageSummary,
    teamUsageError,
  };
}
