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
 *
 * MEMORY REFERENCES:
 * - MEM-0196
 */

export type TabKey =
  | "overview"
  | "kanban"
  | "projects"
  | "memory"
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
export type TeamMemoryEntryKind = "note" | "decision" | "handoff" | "result" | "risk" | "summary";
export type TeamMemoryAuthorType = "agent" | "operator" | "system";

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

export type TeamMemoryRow = {
  id: string;
  teamId?: string;
  projectId: string;
  taskId?: string;
  agentId?: string;
  authorType: TeamMemoryAuthorType;
  kind: TeamMemoryEntryKind;
  body: string;
  createdAt: number;
};

export type AgentCandidate = {
  agentId: string;
  name: string;
};

export type PresenceEmployee = {
  _id: string;
  name: string;
  jobTitle?: string;
  profileImageUrl?: string;
  status?: string;
  statusMessage?: string;
};

export type AgentPresenceRow = {
  employeeId: string;
  agentId: string;
  name: string;
  roleLabel: string;
  avatarUrl?: string;
  liveState?: string;
  statusText: string;
  latestTaskId?: string;
  latestTaskTitle?: string;
  latestTaskStatus?: TaskStatus;
  latestTaskPriority?: TaskPriority;
  latestTaskUpdatedAt?: number;
  latestTaskDetail?: string;
  latestActivityType?: string;
  latestOccurredAt?: number;
  openTaskCount: number;
  blockedTaskCount: number;
  completedTaskCount: number;
  isAssigned: boolean;
};

function normalizeAgentId(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("employee-") ? trimmed.slice("employee-".length) : trimmed;
}

function taskRecency(task: PanelTask): number {
  return task.updatedAt ?? task.createdAt ?? task.dueAt ?? 0;
}

function compareTaskPriority(left: TaskPriority, right: TaskPriority): number {
  const rank: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 };
  return rank[left] - rank[right];
}

function pickLatestTask(tasks: PanelTask[]): PanelTask | undefined {
  return [...tasks].sort((left, right) => {
    if (left.status !== right.status) {
      if (left.status === "in_progress") return -1;
      if (right.status === "in_progress") return 1;
      if (left.status === "blocked") return -1;
      if (right.status === "blocked") return 1;
    }
    const priorityDiff = compareTaskPriority(right.priority, left.priority);
    if (priorityDiff !== 0) return priorityDiff;
    return taskRecency(right) - taskRecency(left);
  })[0];
}

function buildTaskDetail(task: PanelTask | undefined): string | undefined {
  if (!task) return undefined;
  if (task.status === "blocked") return task.notes?.trim() || "Needs intervention.";
  if (task.status === "in_progress")
    return task.notes?.trim() || `Working ${STATUS_LABELS[task.status].toLowerCase()} task.`;
  if (task.status === "done") return task.notes?.trim() || "Most recent task was completed.";
  return task.notes?.trim() || `Queued as ${STATUS_LABELS[task.status].toLowerCase()}.`;
}

function latestTouchedAt(task: PanelTask | undefined): number {
  return task ? taskRecency(task) : 0;
}

function latestCommunicationForAgent(
  rows: CommunicationRow[],
  agentId: string,
): CommunicationRow | undefined {
  return rows
    .filter((row) => row.agentId.trim() === agentId)
    .sort((left, right) => right.occurredAt - left.occurredAt)[0];
}

export function deriveAgentPresenceRows(input: {
  employees: PresenceEmployee[];
  projectTasks: PanelTask[];
  communicationRows: CommunicationRow[];
}): AgentPresenceRow[] {
  const { employees, projectTasks, communicationRows } = input;
  const rows = employees
    .map((employee): AgentPresenceRow | null => {
      const agentId = normalizeAgentId(employee._id);
      if (!agentId) return null;
      const tasks = projectTasks.filter((task) => task.ownerAgentId?.trim() === agentId);
      const openTasks = tasks.filter((task) => task.status !== "done");
      const blockedTasks = tasks.filter((task) => task.status === "blocked");
      const completedTasks = tasks.filter((task) => task.status === "done");
      const latestTask = pickLatestTask(tasks);
      const latestActivity = latestCommunicationForAgent(communicationRows, agentId);
      return {
        employeeId: employee._id,
        agentId,
        name: employee.name,
        roleLabel: employee.jobTitle?.trim() || "Operator",
        avatarUrl: employee.profileImageUrl?.trim() || undefined,
        liveState: employee.status?.trim() || undefined,
        statusText:
          employee.statusMessage?.trim() ||
          latestTask?.title ||
          latestActivity?.detail?.trim() ||
          latestActivity?.label?.trim() ||
          "Standing by",
        latestTaskId: latestTask?.id,
        latestTaskTitle: latestTask?.title,
        latestTaskStatus: latestTask?.status,
        latestTaskPriority: latestTask?.priority,
        latestTaskUpdatedAt: latestTouchedAt(latestTask) || undefined,
        latestTaskDetail: buildTaskDetail(latestTask),
        latestActivityType: latestActivity?.activityType,
        latestOccurredAt: Math.max(latestActivity?.occurredAt ?? 0, latestTouchedAt(latestTask)),
        openTaskCount: openTasks.length,
        blockedTaskCount: blockedTasks.length,
        completedTaskCount: completedTasks.length,
        isAssigned: tasks.length > 0,
      };
    });

  const presentRows = rows.filter((row): row is AgentPresenceRow => row !== null);

  return presentRows.sort((left, right) => {
    if (left.latestOccurredAt !== right.latestOccurredAt) {
      return (right.latestOccurredAt ?? 0) - (left.latestOccurredAt ?? 0);
    }
    if (left.openTaskCount !== right.openTaskCount) {
      return right.openTaskCount - left.openTaskCount;
    }
    return left.name.localeCompare(right.name);
  });
}

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
