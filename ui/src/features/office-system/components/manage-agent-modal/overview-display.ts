/**
 * MANAGE AGENT OVERVIEW DISPLAY
 * =============================
 * Derive game-style overview display data from the existing
 * OpenClaw agent identity and usage payloads.
 *
 * KEY CONCEPTS:
 * - Keep display precedence deterministic so the HUD always resolves the same portrait/name fields.
 * - Convert raw usage totals into bounded visual meters without changing the underlying metrics.
 *
 * USAGE:
 * - Imported by `OverviewTab.tsx` for portrait, labels, and telemetry bars.
 *
 * MEMORY REFERENCES:
 * - MEM-0107
 * - MEM-0160
 */

import type { AgentIdentityResult, AgentsListResult } from "@/lib/openclaw-types";
import type { EmployeeData } from "@/lib/types";
import type { AgentUsageOverview } from "./_types";

type UsageMeter = {
  label: string;
  valueText: string;
  value: number;
};

export type AgentOverviewDisplay = {
  avatarUrl: string;
  displayName: string;
  emoji: string;
  initials: string;
  roleLabel: string;
  teamLabel: string;
  statusLabel: string;
  agentIdLabel: string;
  scopeLabel: string;
  usageMeters: UsageMeter[];
};

type BuildAgentOverviewDisplayInput = {
  employee: EmployeeData | null;
  identity: AgentIdentityResult | null;
  selectedAgent: AgentsListResult["agents"][number] | null;
  selectedAgentId: string | null;
  agentsList: AgentsListResult | null;
  usageOverview: AgentUsageOverview | null;
};

const TOKEN_MILESTONE = 2_000_000;

function clampPercent(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 100) return 100;
  return value;
}

function resolveUsageMeters(usageOverview: AgentUsageOverview | null): UsageMeter[] {
  const latestSessionCost = usageOverview?.latestSession?.sessionTotals.estimatedCostUsd ?? 0;
  const burn24h = usageOverview?.cost24hUsd ?? 0;
  const trackedCost = usageOverview?.totalTrackedCostUsd ?? 0;
  const trackedTokens = usageOverview?.totalTokens ?? 0;

  const costCeiling = Math.max(latestSessionCost, burn24h, trackedCost, 0.01);

  return [
    {
      label: "Latest Session Burn",
      valueText: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
        latestSessionCost,
      ),
      value: clampPercent((latestSessionCost / costCeiling) * 100),
    },
    {
      label: "24h Burn",
      valueText: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
        burn24h,
      ),
      value: clampPercent((burn24h / costCeiling) * 100),
    },
    {
      label: "Token Footprint",
      valueText: new Intl.NumberFormat("en-US").format(trackedTokens),
      value: clampPercent((trackedTokens / TOKEN_MILESTONE) * 100),
    },
  ];
}

export function getAgentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "AG";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "AG";
}

export function buildAgentOverviewDisplay(
  input: BuildAgentOverviewDisplayInput,
): AgentOverviewDisplay {
  const displayName =
    input.identity?.name.trim() ||
    input.selectedAgent?.identity?.name?.trim() ||
    input.employee?.name.trim() ||
    input.selectedAgent?.name?.trim() ||
    input.selectedAgentId?.trim() ||
    "Unknown Agent";
  const avatarUrl =
    input.identity?.avatar?.trim() ||
    input.selectedAgent?.identity?.avatar?.trim() ||
    input.selectedAgent?.identity?.avatarUrl?.trim() ||
    input.employee?.profileImageUrl?.trim() ||
    "";
  const emoji =
    input.identity?.emoji?.trim() || input.selectedAgent?.identity?.emoji?.trim() || "◈";
  const roleLabel = input.employee?.isCEO
    ? "Founder Unit"
    : input.employee?.jobTitle?.trim() || input.employee?.builtInRole?.trim() || "Autonomous Agent";
  const teamLabel = input.employee?.team?.trim() || "Unassigned Team";
  const statusLabel =
    (
      input.employee?.statusMessage?.trim() ||
      input.employee?.status?.trim() ||
      (input.usageOverview ? "Tracking Live" : "")
    ).trim() || "Standing By";
  const scopeLabel = input.agentsList?.scope?.trim() || "workspace";

  return {
    avatarUrl,
    displayName,
    emoji,
    initials: getAgentInitials(displayName),
    roleLabel,
    teamLabel,
    statusLabel,
    agentIdLabel: input.selectedAgentId?.trim() || "n/a",
    scopeLabel,
    usageMeters: resolveUsageMeters(input.usageOverview),
  };
}
