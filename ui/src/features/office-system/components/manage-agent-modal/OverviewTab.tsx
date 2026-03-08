"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { AgentsListResult, AgentIdentityResult } from "@/lib/openclaw-types";
import type { EmployeeData } from "@/lib/types";
import type { AgentConfigDraft } from "./_types";

type OverviewPanelProps = {
  employee: EmployeeData | null;
  agentsList: AgentsListResult | null;
  selectedAgentId: string | null;
  setSelectedAgentId: (agentId: string) => void;
  identity: AgentIdentityResult | null;
  draft: AgentConfigDraft;
  setDraft: (next: AgentConfigDraft) => void;
  isLoading: boolean;
};

export function OverviewPanel(props: OverviewPanelProps): JSX.Element {
  const selectedAgent = props.agentsList?.agents.find((agent) => agent.id === props.selectedAgentId) ?? null;
  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-sm space-y-1">
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
          <Badge variant={props.selectedAgentId === props.agentsList?.defaultId ? "default" : "secondary"}>
            {props.selectedAgentId === props.agentsList?.defaultId ? "default" : "non-default"}
          </Badge>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="text-sm">
          <p className="text-muted-foreground">Identity Name</p>
          <p>{props.identity?.name ?? selectedAgent?.identity?.name ?? props.employee?.name ?? "n/a"}</p>
        </div>
        <div className="text-sm">
          <p className="text-muted-foreground">Identity Emoji</p>
          <p>{props.identity?.emoji ?? selectedAgent?.identity?.emoji ?? "n/a"}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Primary Model</span>
          <Input
            value={props.draft.primaryModel}
            onChange={(event) => props.setDraft({ ...props.draft, primaryModel: event.target.value })}
            placeholder="provider/model"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Fallback Models (comma-separated)</span>
          <Input
            value={props.draft.fallbackModels}
            onChange={(event) => props.setDraft({ ...props.draft, fallbackModels: event.target.value })}
            placeholder="provider/model, provider/model"
          />
        </label>
      </div>
    </div>
  );
}
