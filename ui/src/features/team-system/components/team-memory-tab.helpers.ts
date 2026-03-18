/**
 * TEAM MEMORY TAB HELPERS
 * =======================
 * Shared formatting helpers for the Team Memory tab.
 *
 * KEY CONCEPTS:
 * - Keep light presentation rules out of the component body.
 * - Team memory entries remain append-only; formatting is derived at render time.
 *
 * USAGE:
 * - Import into TeamMemoryTab and related tests.
 *
 * MEMORY REFERENCES:
 * - MEM-0209
 */

import type { TeamMemoryEntryKind, TeamMemoryRow } from "./team-panel-types";

export function formatTeamMemoryKindLabel(kind: TeamMemoryEntryKind): string {
  return kind.replace(/_/g, " ");
}

export function describeTeamMemoryAuthor(entry: TeamMemoryRow): string {
  if (entry.authorType === "operator") return "Operator";
  if (entry.authorType === "system") return "System";
  return entry.agentId?.trim() || "Agent";
}
