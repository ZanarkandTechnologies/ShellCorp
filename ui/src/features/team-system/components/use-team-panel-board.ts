"use client";

/**
 * TEAM PANEL BOARD STATE
 * ======================
 * Purpose
 * - Encapsulate Team Panel board/task/activity queries plus board mutation state.
 *
 * KEY CONCEPTS:
 * - Convex remains the canonical source for live board and activity data when enabled.
 * - Sidecar/company-model task data stays as the fallback for read-only panel rendering.
 *
 * USAGE:
 * - Call from TeamPanel with the resolved project scope.
 *
 * MEMORY REFERENCES:
 * - MEM-0196
 * - MEM-0207
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../../../convex/_generated/api";
import {
  extractArtefactPath,
  type ActivityRow,
  type CommunicationRow,
  type PanelTask,
} from "./team-panel-types";

type CompanyTask = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  ownerAgentId?: string;
  priority?: string;
  provider?: string;
  providerUrl?: string;
  artefactPath?: string;
  artifactPath?: string;
  syncState?: string;
  syncError?: string;
};

type CompanyModelLike = {
  tasks: CompanyTask[];
} | null;

type ProjectLike = {
  id: string;
} | null;

interface UseTeamPanelBoardStateInput {
  companyModel: CompanyModelLike;
  globalMode: boolean;
  project: ProjectLike;
  activeProjectId: string | undefined;
  teamScopeId: string | null;
}

interface BoardActionState {
  pending: boolean;
  error?: string;
  ok?: string;
}

export function useTeamPanelBoardState({
  companyModel,
  globalMode,
  project,
  activeProjectId,
  teamScopeId,
}: UseTeamPanelBoardStateInput): {
  convexEnabled: boolean;
  projectTasks: PanelTask[];
  communicationRows: CommunicationRow[];
  boardActionState: BoardActionState;
  handleBoardCommand: (
    command: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ) => Promise<void>;
} {
  const convexEnabled = isConvexEnabled();
  const [boardActionState, setBoardActionState] = useState<BoardActionState>({
    pending: false,
  });

  const boardCommand = useMutation(api.board.boardCommand);
  const convexBoard = useQuery(
    api.board.getProjectBoard,
    convexEnabled && activeProjectId ? { projectId: activeProjectId } : "skip",
  );
  const convexActivity = useQuery(
    api.board.getProjectActivity,
    convexEnabled && activeProjectId
      ? { projectId: activeProjectId, teamId: teamScopeId ?? undefined, limit: 60 }
      : "skip",
  );

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
        taskType: typeof task.taskType === "string" ? task.taskType : undefined,
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
      .filter((task) => task.projectId === project.id)
      .map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status as PanelTask["status"],
        ownerAgentId: task.ownerAgentId,
        priority: (task.priority as PanelTask["priority"]) ?? "medium",
        provider: (task.provider as PanelTask["provider"]) ?? "internal",
        providerUrl: task.providerUrl,
        artefactPath: extractArtefactPath(task),
        syncState: (task.syncState as PanelTask["syncState"]) ?? "healthy",
        syncError: task.syncError,
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

  return {
    convexEnabled,
    projectTasks,
    communicationRows,
    boardActionState,
    handleBoardCommand,
  };
}
