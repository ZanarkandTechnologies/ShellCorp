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
import type { AgentIdentityResult, AgentsListResult } from "@/lib/openclaw-types";
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

  const appearanceDraft = {
    clothesStyle: props.draft.appearanceClothesStyle ?? "default",
    hairColorOverride: props.draft.appearanceHairColor || null,
    petType: props.draft.appearancePetType ?? "none",
  };
  const heartbeatOverride = props.draft.heartbeatEveryOverride.trim();
  const heartbeatDefault = props.draft.heartbeatDefaultEvery.trim();
  const effectiveHeartbeatCadence = heartbeatOverride || heartbeatDefault || "Not configured";

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

          <EmployeePreviewCard
            employee={props.employee}
            displayName={display.displayName}
            appearanceOverrides={appearanceDraft}
          />

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
        </aside>

        <section className="space-y-4">
          <div className="space-y-6 rounded-md border bg-muted/20 p-4 text-sm">
            <p className="text-base font-medium">Appearance</p>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1">
                <span className="text-muted-foreground">Clothes</span>
                <select
                  className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                  value={appearanceDraft.clothesStyle}
                  onChange={(event) =>
                    props.setDraft({
                      ...props.draft,
                      appearanceClothesStyle: event.target
                        .value as AgentConfigDraft["appearanceClothesStyle"],
                    })
                  }
                >
                  <option value="default">Default</option>
                  <option value="dj">DJ</option>
                  <option value="professional">Professional</option>
                  <option value="techBro">Tech bro</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-muted-foreground">Hair</span>
                <select
                  className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                  value={appearanceDraft.hairColorOverride ?? "default"}
                  onChange={(event) =>
                    props.setDraft({
                      ...props.draft,
                      appearanceHairColor:
                        event.target.value === "default" ? "" : event.target.value,
                    })
                  }
                >
                  <option value="default">Default</option>
                  <option value="#111111">Black</option>
                  <option value="#F5D76E">Blonde</option>
                  <option value="#C62828">Red</option>
                  <option value="#FF4081">Neon pink</option>
                  <option value="#00E5FF">Neon cyan</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-muted-foreground">Pet</span>
                <select
                  className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                  value={appearanceDraft.petType}
                  onChange={(event) =>
                    props.setDraft({
                      ...props.draft,
                      appearancePetType: event.target
                        .value as AgentConfigDraft["appearancePetType"],
                    })
                  }
                >
                  <option value="none">None</option>
                  <option value="dog">Dog</option>
                  <option value="cat">Cat</option>
                  <option value="goldfish">Goldfish</option>
                  <option value="rabbit">Rabbit</option>
                  <option value="lobster">Lobster</option>
                </select>
              </label>
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-medium">Heartbeat</p>
                <p className="text-xs text-muted-foreground">
                  Leave blank to use the shared default.
                </p>
              </div>
              <Badge variant={heartbeatOverride ? "destructive" : "secondary"}>
                {heartbeatOverride ? "override active" : "using default"}
              </Badge>
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              <label
                htmlFor="manage-agent-heartbeat-every"
                className="rounded-md border border-destructive/30 bg-background/60 p-2 space-y-1"
              >
                <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Cadence
                </span>
                <Input
                  id="manage-agent-heartbeat-every"
                  value={props.draft.heartbeatEveryOverride}
                  onChange={(event) =>
                    props.setDraft({
                      ...props.draft,
                      heartbeatEveryOverride: event.target.value,
                    })
                  }
                  placeholder={heartbeatDefault || "10m"}
                  className="border-destructive/30 bg-background/80"
                />
                <p className="text-[11px] text-muted-foreground">
                  Current cadence:{" "}
                  <span className="font-medium text-foreground">{effectiveHeartbeatCadence}</span>
                  {heartbeatOverride
                    ? ` · default ${heartbeatDefault || "unset"}`
                    : " · shared default"}
                </p>
              </label>

              <div className="rounded-md border border-destructive/30 bg-background/60 p-2">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Reasoning
                </p>
                <p className="mt-1 font-medium">
                  {props.draft.heartbeatIncludeReasoning ? "Enabled" : "Disabled"}
                </p>
              </div>

              <div className="rounded-md border border-destructive/30 bg-background/60 p-2">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Target</p>
                <p className="mt-1 font-medium">
                  {props.draft.heartbeatTarget || "No target configured"}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Prompt stays in <code>HEARTBEAT.md</code> or Files.
              {props.draft.heartbeatPrompt.trim() ? " Shared prompt detected." : ""}
            </p>
          </div>

          <div className="rounded-md border bg-muted/20 p-3">
            <div className="space-y-3">
              {display.usageMeters.map((meter) => (
                <div key={meter.label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>{meter.label}</span>
                    <span className="font-medium">{meter.valueText}</span>
                  </div>
                  <Progress value={meter.value} />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            <div className="rounded-md border bg-muted/20 p-2.5 text-sm">
              <p className="text-muted-foreground">AI Burn 7d</p>
              <p className="mt-1 text-lg font-semibold">
                {usdFormatter.format(props.usageOverview?.cost7dUsd ?? 0)}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-2.5 text-sm">
              <p className="text-muted-foreground">AI Burn 24h</p>
              <p className="mt-1 text-lg font-semibold">
                {usdFormatter.format(props.usageOverview?.cost24hUsd ?? 0)}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-2.5 text-sm">
              <p className="text-muted-foreground">Total Cost</p>
              <p className="mt-1 text-lg font-semibold">
                {usdFormatter.format(props.usageOverview?.totalTrackedCostUsd ?? 0)}
              </p>
            </div>
            <div className="rounded-md border bg-muted/20 p-2.5 text-sm">
              <p className="text-muted-foreground">Tokens</p>
              <p className="mt-1 text-lg font-semibold">
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
