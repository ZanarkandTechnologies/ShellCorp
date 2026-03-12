/**
 * TEAM PANEL TYPES
 * ================
 * Shared types, interfaces, and utility functions for Team Panel and its tab components.
 *
 * KEY CONCEPTS:
 * - All types used across multiple tab components live here to avoid circular deps.
 * - Helper functions that operate on panel data are colocated with their types.
 *
 * USAGE:
 * - Import specific types/helpers into tab components as needed.
 */

export type TabKey =
  | "overview"
  | "kanban"
  | "projects"
  | "communications"
  | "timeline"
  | "business"
  | "ledger";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export type TaskProvider = "internal" | "notion" | "vibe" | "linear";

export type TaskSyncState = "healthy" | "pending" | "conflict" | "error";

export type TaskPriority = "low" | "medium" | "high";
export type TaskWorkflowType = "team_proposal";
export type TaskApprovalState =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "executed";

export type CommunicationsFilter = "all" | "planning" | "executing" | "blocked" | "handoff";

export type PanelTask = {
  id: string;
  title: string;
  status: TaskStatus;
  ownerAgentId?: string;
  priority: TaskPriority;
  provider: TaskProvider;
  providerUrl?: string;
  artefactPath?: string;
  syncState: TaskSyncState;
  syncError?: string;
  notes?: string;
  taskType?: TaskWorkflowType;
  approvalState?: TaskApprovalState;
  linkedSessionKey?: string;
  createdTeamId?: string;
  createdProjectId?: string;
  createdAt?: number;
  updatedAt?: number;
  dueAt?: number;
};

export type ActivityRow = {
  _id: string;
  agentId: string;
  activityType: string;
  label: string;
  detail?: string;
  taskId?: string;
  occurredAt: number;
};

export type CommunicationRow = {
  id: string;
  agentId: string;
  activityType: string;
  label: string;
  detail?: string;
  occurredAt: number;
  taskId?: string;
};

export type AgentCandidate = {
  agentId: string;
  name: string;
};

export function statusColumns(tasks: PanelTask[]): Record<TaskStatus, PanelTask[]> {
  return {
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    blocked: tasks.filter((t) => t.status === "blocked"),
    done: tasks.filter((t) => t.status === "done"),
  };
}

export function extractArtefactPath(entry: unknown): string | undefined {
  if (!entry || typeof entry !== "object") return undefined;
  const row = entry as Record<string, unknown>;
  const raw =
    typeof row.artefactPath === "string"
      ? row.artefactPath
      : typeof row.artifactPath === "string"
        ? row.artifactPath
        : "";
  const value = raw.trim();
  return value || undefined;
}

export function deriveProjectId(teamId: string | null): string | null {
  if (!teamId) return null;
  const normalized = teamId.trim().toLowerCase();
  return normalized.startsWith("team-") ? normalized.replace(/^team-/, "") : null;
}

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: "text-red-500 border-red-500/40 bg-red-500/10",
  medium: "text-amber-500 border-amber-500/40 bg-amber-500/10",
  low: "text-green-500 border-green-500/40 bg-green-500/10",
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  blocked: "bg-red-500",
  done: "bg-emerald-500",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
};
