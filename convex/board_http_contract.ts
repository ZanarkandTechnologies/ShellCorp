/**
 * BOARD HTTP CONTRACT
 * ===================
 * Validation helpers for Convex board HTTP ingress endpoints.
 */

export type ParsedBoardCommandPayload = {
  teamId?: string;
  projectId: string;
  command: string;
  taskId?: string;
  title?: string;
  status?: string;
  ownerAgentId?: string;
  priority?: string;
  detail?: string;
  notes?: string;
  taskType?: string;
  approvalState?: string;
  linkedSessionKey?: string;
  createdTeamId?: string;
  createdProjectId?: string;
  label?: string;
  activityType?: string;
  actorType?: string;
  actorAgentId?: string;
  skillId?: string;
  stepKey?: string;
  beatId?: string;
  dueAt?: number;
  occurredAt?: number;
};

export type ParsedBoardQueryPayload = {
  teamId?: string;
  projectId: string;
  query: "tasks" | "board_events" | "activity" | "next";
  taskId?: string;
  agentId?: string;
  limit?: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

export function parseBoardCommandPayload(value: unknown): ParsedBoardCommandPayload | null {
  const record = asRecord(value);
  if (!record) return null;
  const projectId = asTrimmedString(record.projectId);
  const command = asTrimmedString(record.command);
  if (!projectId || !command) return null;
  const payload: ParsedBoardCommandPayload = {
    projectId,
    command,
  };
  const teamId = asTrimmedString(record.teamId);
  const taskId = asTrimmedString(record.taskId);
  const title = asTrimmedString(record.title);
  const status = asTrimmedString(record.status);
  const ownerAgentId = asTrimmedString(record.ownerAgentId);
  const priority = asTrimmedString(record.priority);
  const detail = asTrimmedString(record.detail);
  const notes = asTrimmedString(record.notes);
  const taskType = asTrimmedString(record.taskType);
  const approvalState = asTrimmedString(record.approvalState);
  const linkedSessionKey = asTrimmedString(record.linkedSessionKey);
  const createdTeamId = asTrimmedString(record.createdTeamId);
  const createdProjectId = asTrimmedString(record.createdProjectId);
  const label = asTrimmedString(record.label);
  const activityType = asTrimmedString(record.activityType);
  const actorType = asTrimmedString(record.actorType);
  const actorAgentId = asTrimmedString(record.actorAgentId);
  const skillId = asTrimmedString(record.skillId);
  const stepKey = asTrimmedString(record.stepKey);
  const beatId = asTrimmedString(record.beatId);
  const dueAt = asFiniteNumber(record.dueAt);
  const occurredAt = asFiniteNumber(record.occurredAt);
  if (teamId) payload.teamId = teamId;
  if (taskId) payload.taskId = taskId;
  if (title) payload.title = title;
  if (status) payload.status = status;
  if (ownerAgentId) payload.ownerAgentId = ownerAgentId;
  if (priority) payload.priority = priority;
  if (detail) payload.detail = detail;
  if (notes) payload.notes = notes;
  if (taskType) payload.taskType = taskType;
  if (approvalState) payload.approvalState = approvalState;
  if (linkedSessionKey) payload.linkedSessionKey = linkedSessionKey;
  if (createdTeamId) payload.createdTeamId = createdTeamId;
  if (createdProjectId) payload.createdProjectId = createdProjectId;
  if (label) payload.label = label;
  if (activityType) payload.activityType = activityType;
  if (actorType) payload.actorType = actorType;
  if (actorAgentId) payload.actorAgentId = actorAgentId;
  if (skillId) payload.skillId = skillId;
  if (stepKey) payload.stepKey = stepKey;
  if (beatId) payload.beatId = beatId;
  if (typeof dueAt === "number") payload.dueAt = dueAt;
  if (typeof occurredAt === "number") payload.occurredAt = occurredAt;
  return payload;
}

export function parseBoardQueryPayload(value: unknown): ParsedBoardQueryPayload | null {
  const record = asRecord(value);
  if (!record) return null;
  const projectId = asTrimmedString(record.projectId);
  const query = asTrimmedString(record.query);
  if (!projectId || !query) return null;
  if (query !== "tasks" && query !== "board_events" && query !== "activity" && query !== "next")
    return null;
  const payload: ParsedBoardQueryPayload = {
    projectId,
    query,
  };
  const teamId = asTrimmedString(record.teamId);
  const taskId = asTrimmedString(record.taskId);
  const agentId = asTrimmedString(record.agentId);
  const limit = asFiniteNumber(record.limit);
  if (teamId) payload.teamId = teamId;
  if (taskId) payload.taskId = taskId;
  if (agentId) payload.agentId = agentId;
  if (typeof limit === "number") payload.limit = limit;
  return payload;
}
