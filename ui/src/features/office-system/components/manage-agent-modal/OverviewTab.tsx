"use client";

/**
 * MANAGE AGENT OVERVIEW TAB
 * =========================
 * Presents the selected agent as a game-style status sheet while
 * preserving the existing OpenClaw config controls.
 *
 * KEY CONCEPTS:
 * - Character-sheet layout keeps identity and telemetry readable at a glance.
 * - Inputs still write through the existing draft object with no backend changes.
 *
 * USAGE:
 * - Mounted by `manage-agent-modal/index.tsx` for the overview tab.
 *
 * MEMORY REFERENCES:
 * - MEM-0107
 * - MEM-0160
 */

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { AgentsListResult, AgentIdentityResult } from "@/lib/openclaw-types";
import type { EmployeeData } from "@/lib/types";
import type { AgentConfigDraft, AgentUsageOverview } from "./_types";
import { EmployeePreviewCard } from "./EmployeePreviewCard";
import { buildAgentOverviewDisplay } from "./overview-display";

type OverviewPanelProps = {
  employee: EmployeeData | null;
  agentsList: AgentsListResult | null;
  selectedAgentId: string | null;
  setSelectedAgentId: (agentId: string) => void;
  identity: AgentIdentityResult | null;
  draft: AgentConfigDraft;
  setDraft: (next: AgentConfigDraft) => void;
  isLoading: boolean;
  usageOverview: AgentUsageOverview | null;
};

export function OverviewPanel(props: OverviewPanelProps): JSX.Element {
  const selectedAgent =
    props.agentsList?.agents.find((agent) => agent.id === props.selectedAgentId) ?? null;
  const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const tokenFormatter = new Intl.NumberFormat("en-US");
  const display = buildAgentOverviewDisplay({
    employee: props.employee,
    identity: props.identity,
    selectedAgent,
    selectedAgentId: props.selectedAgentId,
    agentsList: props.agentsList,
    usageOverview: props.usageOverview,
  });
  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-md border bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <label className="flex-1 space-y-1 text-sm">
                <span className="text-muted-foreground">Agent</span>
                <select
                  className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                  value={props.selectedAgentId ?? ""}
                  onChange={(event) => props.setSelectedAgentId(event.target.value)}
                  disabled={props.isLoading}
                >
                  {(props.agentsList?.agents ?? []).map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name ?? agent.id}
                    </option>
                  ))}
                </select>
              </label>
              <div className="text-sm space-y-1">
                <p className="text-muted-foreground">Default</p>
                <Badge
                  variant={
                    props.selectedAgentId === props.agentsList?.defaultId ? "default" : "secondary"
                  }
                >
                  {props.selectedAgentId === props.agentsList?.defaultId
                    ? "default"
                    : "non-default"}
                </Badge>
              </div>
            </div>
          </div>

          <EmployeePreviewCard employee={props.employee} displayName={display.displayName} />

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <p className="text-muted-foreground">Agent ID</p>
              <p className="font-medium">{display.agentIdLabel}</p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <p className="text-muted-foreground">Scope</p>
              <p className="font-medium">{display.scopeLabel}</p>
            </div>
            <div className="col-span-2 rounded-md border bg-muted/20 p-3 text-sm">
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium">{display.statusLabel}</p>
            </div>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="rounded-md border bg-muted/20 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="text-sm">
                <p className="text-muted-foreground">Identity Name</p>
                <p className="text-lg font-semibold">{display.displayName}</p>
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground">Role</p>
                <p className="text-lg font-semibold">{display.roleLabel}</p>
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground">Team</p>
                <p>{display.teamLabel}</p>
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground">Identity Emoji</p>
                <p>{display.emoji}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 rounded-md border bg-muted/20 p-4 text-sm">
              <label htmlFor="manage-agent-primary-model" className="text-muted-foreground">
                Primary Model
              </label>
              <Input
                id="manage-agent-primary-model"
                value={props.draft.primaryModel}
                onChange={(event) =>
                  props.setDraft({ ...props.draft, primaryModel: event.target.value })
                }
                placeholder="provider/model"
              />
            </div>
            <div className="space-y-2 rounded-md border bg-muted/20 p-4 text-sm">
              <label htmlFor="manage-agent-fallback-models" className="text-muted-foreground">
                Fallback Models (comma-separated)
              </label>
              <Input
                id="manage-agent-fallback-models"
                value={props.draft.fallbackModels}
                onChange={(event) =>
                  props.setDraft({ ...props.draft, fallbackModels: event.target.value })
                }
                placeholder="provider/model, provider/model"
              />
            </div>
          </div>

          <div className="rounded-md border bg-muted/20 p-4">
            <div className="space-y-4">
              {display.usageMeters.map((meter) => (
                <div key={meter.label} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>{meter.label}</span>
                    <span className="font-medium">{meter.valueText}</span>
                  </div>
                  <Progress value={meter.value} />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <p className="text-muted-foreground">Latest Session Cost</p>
              <p className="text-lg font-semibold">
                {props.usageOverview?.latestSession
                  ? usdFormatter.format(
                      props.usageOverview.latestSession.sessionTotals.estimatedCostUsd,
                    )
                  : "Unavailable"}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <p className="text-muted-foreground">AI Burn 24h</p>
              <p className="text-lg font-semibold">
                {usdFormatter.format(props.usageOverview?.cost24hUsd ?? 0)}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <p className="text-muted-foreground">Tracked Total Cost</p>
              <p className="text-lg font-semibold">
                {usdFormatter.format(props.usageOverview?.totalTrackedCostUsd ?? 0)}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <p className="text-muted-foreground">Tracked Tokens</p>
              <p className="text-lg font-semibold">
                {tokenFormatter.format(props.usageOverview?.totalTokens ?? 0)}
              </p>
            </div>
          </div>
        </section>
      </div>
      {props.usageOverview ? (
        <div className="text-xs text-muted-foreground">
          Tracked sessions: {props.usageOverview.trackedSessions}
          {props.usageOverview.unavailableText ? ` | ${props.usageOverview.unavailableText}` : ""}
        </div>
      ) : null}
    </div>
  );
}
