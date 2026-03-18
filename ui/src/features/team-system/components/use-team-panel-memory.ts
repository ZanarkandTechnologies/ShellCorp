"use client";

/**
 * TEAM PANEL MEMORY STATE
 * =======================
 * Purpose
 * - Encapsulate realtime team memory queries plus operator append state.
 *
 * KEY CONCEPTS:
 * - Shared team memory is append-only and Convex-backed.
 * - The panel only needs a small composer for operator notes; agents can use the same mutation later.
 *
 * USAGE:
 * - Call from TeamPanel with the resolved project/team scope.
 *
 * MEMORY REFERENCES:
 * - MEM-0209
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { isConvexEnabled } from "@/providers/convex-provider";
import type { TeamMemoryEntryKind, TeamMemoryRow } from "./team-panel-types";

interface UseTeamPanelMemoryStateInput {
  activeProjectId: string | undefined;
  teamScopeId: string | null;
}

interface MemoryComposeState {
  pending: boolean;
  error?: string;
  ok?: string;
}

export function useTeamPanelMemoryState({
  activeProjectId,
  teamScopeId,
}: UseTeamPanelMemoryStateInput): {
  convexEnabled: boolean;
  memoryRows: TeamMemoryRow[];
  composeState: MemoryComposeState;
  appendOperatorNote: (input: { kind: TeamMemoryEntryKind; body: string }) => Promise<boolean>;
} {
  const convexEnabled = isConvexEnabled();
  const [composeState, setComposeState] = useState<MemoryComposeState>({ pending: false });

  const appendEntry = useMutation(api.team_memory.appendTeamMemoryEntry);
  const memoryQuery = useQuery(
    api.team_memory.listProjectTeamMemory,
    convexEnabled && activeProjectId ? { projectId: activeProjectId, limit: 160 } : "skip",
  );

  const memoryRows = useMemo(
    (): TeamMemoryRow[] =>
      Array.isArray(memoryQuery)
        ? memoryQuery.map((row) => ({
            id: String(row._id),
            teamId: row.teamId,
            projectId: row.projectId,
            taskId: row.taskId,
            agentId: row.agentId,
            authorType: row.authorType as TeamMemoryRow["authorType"],
            kind: row.kind as TeamMemoryEntryKind,
            body: row.body,
            createdAt: row.createdAt,
          }))
        : [],
    [memoryQuery],
  );

  async function appendOperatorNote(input: {
    kind: TeamMemoryEntryKind;
    body: string;
  }): Promise<boolean> {
    if (!convexEnabled || !activeProjectId) return false;
    const body = input.body.trim();
    if (!body) {
      setComposeState({ pending: false, error: "memory_body_required" });
      return false;
    }
    setComposeState({ pending: true });
    try {
      await appendEntry({
        teamId: teamScopeId ?? undefined,
        projectId: activeProjectId,
        authorType: "operator",
        kind: input.kind,
        body,
      });
      setComposeState({ pending: false, ok: "Note added." });
      return true;
    } catch (error) {
      setComposeState({
        pending: false,
        error: error instanceof Error ? error.message : "team_memory_append_failed",
      });
      return false;
    }
  }

  return {
    convexEnabled,
    memoryRows,
    composeState,
    appendOperatorNote,
  };
}
