/**
 * STATUS CONTRACT
 * ===============
 * Shared status event/state contracts used by Convex mutations and HTTP validation.
 *
 * KEY CONCEPTS:
 * - Agent status is event-driven and reduced to one current row.
 * - Self-reported events are authoritative for operator-facing progress text.
 * - Skill/tool calls are breadcrumbs that enrich status bubbles.
 *
 * USAGE:
 * - Parse and normalize incoming report payloads.
 * - Reduce event rows into next `agentStatus` shape.
 *
 * MEMORY REFERENCES:
 * - MEM-0114
 * - MEM-0140
 */

export type AgentState =
  | "running"
  | "ok"
  | "no_work"
  | "error"
  | "idle"
  | "planning"
  | "executing"
  | "blocked"
  | "done";

export type AgentEventType =
  | "heartbeat_start"
  | "heartbeat_ok"
  | "heartbeat_end"
  | "heartbeat_no_work"
  | "heartbeat_error"
  | "activity_log"
  | "tool_call"
  | "skill_call"
  | "status_report"
  | "skill_start"
  | "skill_end";

export type AgentBubble = {
  id: string;
  label: string;
  weight: number;
};

export type AgentStatusSnapshot = {
  state: AgentState;
  statusText: string;
  bubbles: AgentBubble[];
  currentBeatId?: string;
};

export type StatusEventInput = {
  eventType: AgentEventType;
  label: string;
  detail?: string;
  beatId?: string;
  state?: AgentState;
  skillId?: string;
  activityType?: string;
};

const STATUS_WEIGHT = 100;
const ACTIVITY_WEIGHT = 90;
const MAX_BUBBLES = 3;

function statusBubble(state: AgentState): AgentBubble | null {
  if (state === "running" || state === "executing") return { id: "status-running", label: "Heartbeat", weight: STATUS_WEIGHT };
  if (state === "error" || state === "blocked") return { id: "status-error", label: "Error", weight: STATUS_WEIGHT };
  return null;
}

function bubbleId(label: string): string {
  return `bubble-${label.toLowerCase().replace(/[^a-z0-9-_]+/g, "-")}`;
}

function withActivityBubble(existing: AgentBubble[], label: string): AgentBubble[] {
  const normalizedLabel = label.trim() || "Activity";
  const next = existing.filter((bubble) => bubble.id !== bubbleId(normalizedLabel));
  next.unshift({
    id: bubbleId(normalizedLabel),
    label: normalizedLabel,
    weight: ACTIVITY_WEIGHT,
  });
  return next;
}

function trimBubbles(state: AgentState, bubbles: AgentBubble[]): AgentBubble[] {
  const sBubble = statusBubble(state);
  const merged = sBubble ? [sBubble, ...bubbles] : bubbles;
  return merged.slice(0, MAX_BUBBLES);
}

export function reduceStatus(previous: AgentStatusSnapshot, event: StatusEventInput): AgentStatusSnapshot {
  let state = previous.state;
  let statusText = previous.statusText;
  let bubbles = [...previous.bubbles];
  let currentBeatId = previous.currentBeatId;

  if (event.eventType === "heartbeat_start") {
    state = "running";
    statusText = "Heartbeat running";
    currentBeatId = event.beatId;
    bubbles = [];
  } else if (event.eventType === "heartbeat_ok" || event.eventType === "heartbeat_end") {
    state = "ok";
    statusText = "Heartbeat OK";
    currentBeatId = undefined;
    bubbles = [];
  } else if (event.eventType === "heartbeat_no_work") {
    state = "no_work";
    statusText = "Heartbeat no work";
    currentBeatId = undefined;
    bubbles = [];
  } else if (event.eventType === "heartbeat_error") {
    state = "error";
    statusText = event.detail ? `Heartbeat error: ${event.detail}` : "Heartbeat error";
    currentBeatId = undefined;
    bubbles = [];
  } else if (event.eventType === "activity_log") {
    const activityType = event.activityType?.trim();
    if (activityType === "planning") {
      state = "planning";
      statusText = event.detail?.trim() || event.label.trim() || "Planning";
      bubbles = withActivityBubble(bubbles, "Planning");
    } else if (activityType === "executing") {
      state = "executing";
      statusText = event.detail?.trim() || event.label.trim() || "Executing";
      bubbles = withActivityBubble(bubbles, "Executing");
    } else if (activityType === "blocked") {
      state = "blocked";
      statusText = event.detail?.trim() || event.label.trim() || "Blocked";
      bubbles = withActivityBubble(bubbles, "Blocked");
    } else if (activityType === "summary") {
      state = "done";
      statusText = event.detail?.trim() || event.label.trim() || "Summary";
      bubbles = withActivityBubble(bubbles, event.label || "Summary");
    } else {
      statusText = event.detail?.trim() || event.label.trim() || statusText;
      bubbles = withActivityBubble(bubbles, event.label || "Status");
    }
  } else if (event.eventType === "status_report") {
    state = event.state ?? state;
    statusText = event.detail?.trim() || event.label.trim() || statusText;
    bubbles = withActivityBubble(bubbles, event.label || "Status");
  } else if (event.eventType === "skill_start") {
    if (state !== "error" && state !== "blocked") state = "executing";
    statusText = event.detail?.trim() || `Running ${event.label.trim() || "skill"}`;
    bubbles = withActivityBubble(bubbles, event.label || event.skillId || "Skill");
  } else if (event.eventType === "skill_end") {
    if (state === "executing" || state === "running") state = "planning";
    statusText = event.detail?.trim() || `Completed ${event.label.trim() || "skill"}`;
    bubbles = withActivityBubble(bubbles, event.label || event.skillId || "Skill");
  } else if (event.eventType === "tool_call" || event.eventType === "skill_call") {
    bubbles = withActivityBubble(bubbles, event.label || "Tool");
    if (state === "running" || state === "executing" || state === "planning") {
      statusText = `Running ${event.label.trim() || "tool"}`;
    }
  }

  return {
    state,
    statusText,
    bubbles: trimBubbles(state, bubbles),
    currentBeatId,
  };
}

export function coerceAgentState(value: string | undefined): AgentState | undefined {
  if (!value) return undefined;
  if (
    value === "running" ||
    value === "ok" ||
    value === "no_work" ||
    value === "error" ||
    value === "idle" ||
    value === "planning" ||
    value === "executing" ||
    value === "blocked" ||
    value === "done"
  ) {
    return value;
  }
  return undefined;
}

export function coerceAgentEventType(value: string | undefined): AgentEventType | undefined {
  if (!value) return undefined;
  if (
    value === "heartbeat_start" ||
    value === "heartbeat_ok" ||
    value === "heartbeat_end" ||
    value === "heartbeat_no_work" ||
    value === "heartbeat_error" ||
    value === "activity_log" ||
    value === "tool_call" ||
    value === "skill_call" ||
    value === "status_report" ||
    value === "skill_start" ||
    value === "skill_end"
  ) {
    return value;
  }
  return undefined;
}

