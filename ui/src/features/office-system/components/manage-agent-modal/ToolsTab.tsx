"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ToolCatalogGroup, ToolCatalogProfile, ToolsCatalogResult } from "@/lib/openclaw-types";
import type { AgentConfigDraft } from "./_types";

function toCommaList(value: string[]): string {
  return value.join(", ");
}

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

type ToolsPanelProps = {
  draft: AgentConfigDraft;
  setDraft: (next: AgentConfigDraft) => void;
  toolsCatalog: ToolsCatalogResult | null;
  onReloadConfig: () => Promise<void>;
};

export function ToolsPanel(props: ToolsPanelProps): JSX.Element {
  const groups = props.toolsCatalog?.groups ?? [];
  const profiles = props.toolsCatalog?.profiles ?? [];
  const allToolIds = groups.flatMap((group) => group.tools.map((tool) => tool.id));
  return (
    <div className="rounded-md border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Tool access profile + per-tool overrides. {props.draft.toolsAllow.length}/{allToolIds.length || 0} explicit allows.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              props.setDraft({
                ...props.draft,
                toolsAllow: [...new Set([...(props.draft.toolsAllow ?? []), ...allToolIds])],
                toolsDeny: [],
              })
            }
            disabled={allToolIds.length === 0}
          >
            Enable All
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              props.setDraft({
                ...props.draft,
                toolsAllow: [],
                toolsDeny: [...new Set([...(props.draft.toolsDeny ?? []), ...allToolIds])],
              })
            }
            disabled={allToolIds.length === 0}
          >
            Disable All
          </Button>
          <Button size="sm" variant="outline" onClick={() => void props.onReloadConfig()}>
            Reload Config
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Tool Profile</span>
          <select
            className="w-full rounded-md border bg-background px-2 py-2 text-sm"
            value={props.draft.toolsProfile}
            onChange={(event) => props.setDraft({ ...props.draft, toolsProfile: event.target.value })}
          >
            <option value="">inherit/default</option>
            {profiles.map((profile: ToolCatalogProfile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-1 text-sm">
          <span className="text-muted-foreground block">Quick Presets</span>
          <div className="flex flex-wrap gap-2">
            {profiles.map((profile: ToolCatalogProfile) => (
              <Button
                key={profile.id}
                size="sm"
                variant={props.draft.toolsProfile === profile.id ? "default" : "outline"}
                onClick={() => props.setDraft({ ...props.draft, toolsProfile: profile.id })}
              >
                {profile.label}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => props.setDraft({ ...props.draft, toolsProfile: "" })}>
              Inherit
            </Button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Also Allow</span>
          <Textarea
            className="min-h-28 font-mono text-xs"
            value={toCommaList(props.draft.toolsAllow)}
            onChange={(event) => props.setDraft({ ...props.draft, toolsAllow: parseCommaList(event.target.value) })}
            placeholder="tool.id, plugin.tool.id"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Deny</span>
          <Textarea
            className="min-h-28 font-mono text-xs"
            value={toCommaList(props.draft.toolsDeny)}
            onChange={(event) => props.setDraft({ ...props.draft, toolsDeny: parseCommaList(event.target.value) })}
            placeholder="tool.id, plugin.tool.id"
          />
        </label>
      </div>
      {groups.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Tool Catalog</p>
          <div className="max-h-44 overflow-auto rounded-md border p-2">
            {groups.map((group: ToolCatalogGroup) => (
              <div key={group.id} className="mb-3">
                <p className="text-xs font-medium">{group.label}</p>
                <div className="mt-1 grid grid-cols-1 gap-1 md:grid-cols-2">
                  {group.tools.map((tool) => {
                    const checked = props.draft.toolsAllow.includes(tool.id);
                    return (
                      <label key={tool.id} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const next = event.target.checked
                              ? [...props.draft.toolsAllow, tool.id]
                              : props.draft.toolsAllow.filter((entry) => entry !== tool.id);
                            props.setDraft({ ...props.draft, toolsAllow: [...new Set(next)] });
                          }}
                        />
                        <span>{tool.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
