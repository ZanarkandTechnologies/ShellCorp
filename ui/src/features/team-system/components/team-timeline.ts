/**
 * TEAM TIMELINE HELPERS
 * =====================
 * Shared normalization for team timeline UI rows.
 */

export type CommunicationRow = {
  id: string;
  agentId: string;
  activityType: string;
  label: string;
  detail?: string;
  occurredAt: number;
  taskId?: string;
};

export type TeamTimelineRow = {
  _id: string;
  sourceType: "board_event" | "agent_event";
  occurredAt: number;
  projectId: string;
  agentId?: string;
  actorAgentId?: string;
  activityType?: string;
  eventType?: string;
  label: string;
  detail?: string;
  taskId?: string;
};

export function buildTeamTimelineRows(params: {
  convexTimeline: TeamTimelineRow[] | undefined;
  communicationRows: CommunicationRow[];
  projectId: string | undefined;
}): TeamTimelineRow[] {
  if (Array.isArray(params.convexTimeline) && params.convexTimeline.length > 0)
    return params.convexTimeline;
  return params.communicationRows.map((row) => ({
    _id: row.id,
    sourceType: "agent_event",
    occurredAt: row.occurredAt,
    projectId: params.projectId ?? "project",
    agentId: row.agentId,
    activityType: row.activityType,
    label: row.label,
    detail: row.detail,
    taskId: row.taskId,
  }));
}
