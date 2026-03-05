/**
 * BOARD CONTRACT
 * ==============
 * Shared task board and activity contracts for Convex-backed team command boards.
 *
 * KEY CONCEPTS:
 * - Convex is canonical for team task state and agent activity logs.
 * - Task lifecycle writes always emit append-only board events.
 * - Activity timeline rows are stored in `agentEvents` with `activityType` metadata.
 *
 * USAGE:
 * - Validate mutation/query inputs and HTTP command payloads.
 * - Keep task/event/activity enums centralized for CLI + UI consistency.
 *
 * MEMORY REFERENCES:
 * - MEM-0129
 * - MEM-0140
 */

export type BoardTaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type BoardTaskPriority = "low" | "medium" | "high";
export type BoardTaskProvider = "internal";
export type BoardTaskSyncState = "healthy" | "pending" | "conflict" | "error";

export type BoardEventType =
  | "task_created"
  | "task_updated"
  | "task_deleted"
  | "task_moved"
  | "task_assigned"
  | "task_blocked"
  | "task_done"
  | "task_reopened"
  | "task_reprioritized";

export type ActivityEventType =
  | "planning"
  | "research"
  | "executing"
  | "distributing"
  | "blocked"
  | "handoff"
  | "summary"
  | "status";

export type BoardActorType = "agent" | "operator" | "system";

export function coerceBoardTaskStatus(value: string | undefined): BoardTaskStatus | undefined {
  if (!value) return undefined;
  if (value === "todo" || value === "in_progress" || value === "blocked" || value === "done") return value;
  return undefined;
}

export function coerceBoardTaskPriority(value: string | undefined): BoardTaskPriority | undefined {
  if (!value) return undefined;
  if (value === "low" || value === "medium" || value === "high") return value;
  return undefined;
}

export function coerceBoardEventType(value: string | undefined): BoardEventType | undefined {
  if (!value) return undefined;
  if (
    value === "task_created" ||
    value === "task_updated" ||
    value === "task_deleted" ||
    value === "task_moved" ||
    value === "task_assigned" ||
    value === "task_blocked" ||
    value === "task_done" ||
    value === "task_reopened" ||
    value === "task_reprioritized"
  ) {
    return value;
  }
  return undefined;
}

export function coerceActivityEventType(value: string | undefined): ActivityEventType | undefined {
  if (!value) return undefined;
  if (
    value === "planning" ||
    value === "research" ||
    value === "executing" ||
    value === "distributing" ||
    value === "blocked" ||
    value === "handoff" ||
    value === "summary" ||
    value === "status"
  ) {
    return value;
  }
  return undefined;
}

export function coerceBoardActorType(value: string | undefined): BoardActorType | undefined {
  if (!value) return undefined;
  if (value === "agent" || value === "operator" || value === "system") return value;
  return undefined;
}

