/**
 * SESSION USAGE
 * =============
 * Helpers for aggregating OpenClaw transcript-derived token and cost usage.
 *
 * KEY CONCEPTS:
 * - Session usage comes from OpenClaw transcript `message.usage` blocks.
 * - Team summaries are derived from per-session usage snapshots without mutating ledger state.
 *
 * USAGE:
 * - Agent Session panel renders one session summary.
 * - Team Panel rolls recent session summaries into AI burn KPIs.
 *
 * MEMORY REFERENCES:
 * - MEM-0131
 */
import type { SessionTimelineModel, SessionUsageTotals } from "./openclaw-types";

export interface TeamUsageSessionEntry {
  agentId: string;
  occurredAt?: number;
  usageSummary?: SessionTimelineModel["usageSummary"];
}

export interface TeamAiUsageSummary {
  trackedAgents: number;
  trackedSessions: number;
  cost24hUsd: number;
  cost7dUsd: number;
  totalTrackedCostUsd: number;
  totalTokens: number;
}

export function emptyUsageTotals(): SessionUsageTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    responseCount: 0,
  };
}

export function sumUsageTotals(rows: Array<SessionTimelineModel["usageSummary"] | undefined>): SessionUsageTotals {
  return rows.reduce<SessionUsageTotals>((sum, usageSummary) => {
    const totals = usageSummary?.sessionTotals;
    if (!totals) return sum;
    return {
      inputTokens: sum.inputTokens + totals.inputTokens,
      outputTokens: sum.outputTokens + totals.outputTokens,
      cacheReadTokens: sum.cacheReadTokens + totals.cacheReadTokens,
      cacheWriteTokens: sum.cacheWriteTokens + totals.cacheWriteTokens,
      totalTokens: sum.totalTokens + totals.totalTokens,
      estimatedCostUsd: sum.estimatedCostUsd + totals.estimatedCostUsd,
      responseCount: sum.responseCount + totals.responseCount,
    };
  }, emptyUsageTotals());
}

export function buildTeamAiUsageSummary(
  rows: TeamUsageSessionEntry[],
): TeamAiUsageSummary {
  const trackedAgents = new Set<string>();
  let trackedSessions = 0;
  let cost24hUsd = 0;
  let cost7dUsd = 0;
  let totalTrackedCostUsd = 0;
  let totalTokens = 0;

  for (const row of rows) {
    const totals = row.usageSummary?.sessionTotals;
    if (!totals) continue;
    trackedAgents.add(row.agentId);
    trackedSessions += 1;
    totalTrackedCostUsd += totals.estimatedCostUsd;
    totalTokens += totals.totalTokens;
    cost24hUsd += row.usageSummary?.last24Hours?.estimatedCostUsd ?? 0;
    cost7dUsd += row.usageSummary?.last7Days?.estimatedCostUsd ?? 0;
  }

  return {
    trackedAgents: trackedAgents.size,
    trackedSessions,
    cost24hUsd,
    cost7dUsd,
    totalTrackedCostUsd,
    totalTokens,
  };
}
