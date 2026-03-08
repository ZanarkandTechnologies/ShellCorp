"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SkillItemModel, SkillStatusReport } from "@/lib/openclaw-types";
import type { AgentConfigDraft } from "./_types";

type SkillsPanelProps = {
  draft: AgentConfigDraft;
  setDraft: (next: AgentConfigDraft) => void;
  skillsReport: SkillStatusReport | null;
  fallbackSkills: SkillItemModel[];
  onReloadConfig: () => Promise<void>;
  onRefreshSkills: () => Promise<void>;
};

export function SkillsPanel(props: SkillsPanelProps): JSX.Element {
  const [filter, setFilter] = useState("");
  const selected = new Set(props.draft.selectedSkills);
  const reportRows = props.skillsReport?.skills ?? [];
  const fallbackRows = props.fallbackSkills.map((entry) => ({
    name: entry.name,
    description: "",
    source: entry.scope === "agent" ? "agent-level" : "user-level",
  }));
  const merged = new Map<string, { name: string; description: string; source: string }>();
  for (const entry of reportRows) {
    merged.set(entry.name, { name: entry.name, description: entry.description, source: entry.source || "unknown" });
  }
  for (const entry of fallbackRows) {
    if (!merged.has(entry.name)) merged.set(entry.name, entry);
  }
  const filteredSkills = [...merged.values()].filter((entry) =>
    `${entry.name} ${entry.description} ${entry.source}`.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  const userLevel = filteredSkills.filter((entry) => !entry.source.toLowerCase().includes("agent"));
  const agentLevel = filteredSkills.filter((entry) => entry.source.toLowerCase().includes("agent"));
  const toggleBatch = (skills: string[], enabled: boolean) => {
    const next = new Set(props.draft.selectedSkills);
    for (const skill of skills) {
      if (enabled) next.add(skill);
      else next.delete(skill);
    }
    props.setDraft({
      ...props.draft,
      skillsMode: "selected",
      selectedSkills: [...next],
    });
  };
  return (
    <div className="rounded-md border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Per-agent skill allowlist with user-level + agent-level visibility. {filteredSkills.length} shown.
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void props.onReloadConfig()}>
            Reload Config
          </Button>
          <Button size="sm" variant="outline" onClick={() => void props.onRefreshSkills()}>
            Refresh
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={props.draft.skillsMode === "all" ? "default" : "outline"}
          onClick={() => props.setDraft({ ...props.draft, skillsMode: "all" })}
        >
          Use All
        </Button>
        <Button
          size="sm"
          variant={props.draft.skillsMode === "none" ? "default" : "outline"}
          onClick={() => props.setDraft({ ...props.draft, skillsMode: "none", selectedSkills: [] })}
        >
          Disable All
        </Button>
        <Button
          size="sm"
          variant={props.draft.skillsMode === "selected" ? "default" : "outline"}
          onClick={() => props.setDraft({ ...props.draft, skillsMode: "selected" })}
        >
          Custom
        </Button>
      </div>
      <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search skills" />
      <div className="max-h-[46vh] overflow-auto rounded-md border p-3 space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">USER-LEVEL SKILLS</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => toggleBatch(userLevel.map((row) => row.name), true)}>
                Batch Enable
              </Button>
              <Button size="sm" variant="outline" onClick={() => toggleBatch(userLevel.map((row) => row.name), false)}>
                Batch Disable
              </Button>
            </div>
          </div>
          {userLevel.map((row) => (
            <label key={`user-${row.name}`} className="flex items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={selected.has(row.name)}
                disabled={props.draft.skillsMode !== "selected"}
                onChange={(event) => {
                  const next = new Set(props.draft.selectedSkills);
                  if (event.target.checked) next.add(row.name);
                  else next.delete(row.name);
                  props.setDraft({ ...props.draft, selectedSkills: [...next], skillsMode: "selected" });
                }}
              />
              <span>{row.name}</span>
            </label>
          ))}
          {userLevel.length === 0 ? <p className="text-xs text-muted-foreground">No user-level skills found.</p> : null}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">AGENT-LEVEL SKILLS</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => toggleBatch(agentLevel.map((row) => row.name), true)}>
                Batch Enable
              </Button>
              <Button size="sm" variant="outline" onClick={() => toggleBatch(agentLevel.map((row) => row.name), false)}>
                Batch Disable
              </Button>
            </div>
          </div>
          {agentLevel.map((row) => (
            <label key={`agent-${row.name}`} className="flex items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={selected.has(row.name)}
                disabled={props.draft.skillsMode !== "selected"}
                onChange={(event) => {
                  const next = new Set(props.draft.selectedSkills);
                  if (event.target.checked) next.add(row.name);
                  else next.delete(row.name);
                  props.setDraft({ ...props.draft, selectedSkills: [...next], skillsMode: "selected" });
                }}
              />
              <span>{row.name}</span>
            </label>
          ))}
          {agentLevel.length === 0 ? <p className="text-xs text-muted-foreground">No agent-level skills found.</p> : null}
        </div>
      </div>
    </div>
  );
}
