/**
 * AGENT MEMORY TIMELINE HELPERS
 * =============================
 * Builds timeline rows from Convex events or memory entries fallback.
 */

import type { AgentMemoryEntry } from "@/lib/openclaw-types";

export type AgentEventRow = {
  _id: string;
  eventType: string;
  label: string;
  detail?: string;
  occurredAt: number;
  state?: string;
  sessionKey?: string;
};

export type AgentTimelineRow = {
  id: string;
  ts: number;
  kind: string;
  label: string;
  detail?: string;
  source: string;
};

export function buildAgentTimelineRows(params: {
  convexAgentEvents: AgentEventRow[] | undefined;
  entries: AgentMemoryEntry[];
}): AgentTimelineRow[] {
  if (Array.isArray(params.convexAgentEvents) && params.convexAgentEvents.length > 0) {
    return params.convexAgentEvents.map((event) => ({
      id: event._id,
      ts: event.occurredAt,
      kind: event.eventType,
      label: event.label,
      detail: event.detail,
      source: event.sessionKey ? `session:${event.sessionKey}` : "convex",
    }));
  }
  return params.entries.map((entry) => ({
    id: entry.id,
    ts: entry.ts ?? 0,
    kind: entry.type ?? "memory",
    label: entry.text,
    detail: entry.memId ? `MEM: ${entry.memId}` : undefined,
    source: entry.source.sourcePath,
  }));
}
