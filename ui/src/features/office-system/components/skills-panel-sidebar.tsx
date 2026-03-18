/**
 * SKILLS PANEL SIDEBAR
 * ====================
 * Renders the runtime skill list for global and agent-focused Skills views.
 *
 * KEY CONCEPTS:
 * - Global view manages shared runtime/global config rows.
 * - Agent view separates workspace-installed and inherited runtime skills.
 *
 * USAGE:
 * - Rendered by `skills-panel.tsx`.
 *
 * MEMORY REFERENCES:
 * - MEM-0205
 */

import { useMemo, useState, type ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { InstalledSkillEntry } from "@/lib/openclaw-types";
import type { GlobalSkillRow } from "./skills-panel.runtime";
import type { GroupedInheritedRuntimeSkills } from "./skills-panel-types";

type Props = {
  focusAgentId: string | null;
  runtimeStatusText: string;
  selectedSkillId: string | null;
  filteredWorkspaceSkills: InstalledSkillEntry[];
  groupedInheritedRuntimeSkills: GroupedInheritedRuntimeSkills;
  filteredGlobalSkillRows: GlobalSkillRow[];
  isSavingGlobalConfig: boolean;
  isMutatingWorkspace: boolean;
  isAgentSkillEquipped: (skillId: string) => boolean;
  onRefresh: () => void;
  onSelectSkill: (skillId: string) => void;
  onToggleGlobalSkill: (skillKey: string, enabled: boolean) => void;
  onToggleAgentSkill: (skillId: string) => void;
  onToggleWorkspaceSkill: (skillId: string, install: boolean) => void;
};

function SectionHeader({
  title,
  count,
  open,
}: {
  title: string;
  count: number;
  open: boolean;
}): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <span>{title}</span>
      <div className="flex items-center gap-2">
        <span>{count}</span>
        <span className="text-xs">{open ? "-" : "+"}</span>
      </div>
    </div>
  );
}

function describeGlobalSkillRow(row: GlobalSkillRow): string {
  if (row.hasSharedInstall) {
    if (row.envCount > 0 || row.configCount > 0) {
      return `Shared runtime skill with ${row.envCount} env value${row.envCount === 1 ? "" : "s"} and ${row.configCount} config field${row.configCount === 1 ? "" : "s"}.`;
    }
    return "Shared runtime skill installed in the global OpenClaw skills directory.";
  }
  if (row.envCount > 0 || row.configCount > 0) {
    return `Config-only global entry with ${row.envCount} env value${row.envCount === 1 ? "" : "s"} and ${row.configCount} config field${row.configCount === 1 ? "" : "s"}.`;
  }
  return "Global skill entry available for instance-level enable and disable.";
}

export function SkillsPanelSidebar({
  focusAgentId,
  runtimeStatusText,
  selectedSkillId,
  filteredWorkspaceSkills,
  groupedInheritedRuntimeSkills,
  filteredGlobalSkillRows,
  isSavingGlobalConfig,
  isMutatingWorkspace,
  isAgentSkillEquipped,
  onRefresh,
  onSelectSkill,
  onToggleGlobalSkill,
  onToggleAgentSkill,
  onToggleWorkspaceSkill,
}: Props): ReactElement {
  const [openAgentOwned, setOpenAgentOwned] = useState(true);
  const [openGlobal, setOpenGlobal] = useState(true);
  const [openBundled, setOpenBundled] = useState(false);
  const globalInheritedSkills = useMemo(
    () =>
      groupedInheritedRuntimeSkills
        .filter(([label]) => label !== "OpenClaw Bundled")
        .flatMap(([, entries]) => entries),
    [groupedInheritedRuntimeSkills],
  );
  const bundledInheritedSkills = useMemo(
    () =>
      groupedInheritedRuntimeSkills
        .filter(([label]) => label === "OpenClaw Bundled")
        .flatMap(([, entries]) => entries),
    [groupedInheritedRuntimeSkills],
  );

  return (
    <>
      <div className="mt-3 flex items-center justify-between gap-3 border-b pb-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {focusAgentId ? "Agent Runtime" : "Global Runtime"}
          </p>
          {runtimeStatusText ? (
            <p className="mt-1 text-[11px] text-muted-foreground">{runtimeStatusText}</p>
          ) : null}
        </div>
        <Button size="sm" variant="ghost" onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      <ScrollArea className="mt-4 min-h-0 flex-1 [&>[data-slot=scroll-area-viewport]]:pr-3">
        <>
          {focusAgentId ? (
            <>
              <Collapsible
                open={openAgentOwned}
                onOpenChange={setOpenAgentOwned}
                className="w-full pt-2"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="block w-full rounded-md border px-2 py-2 text-left hover:bg-muted/30"
                  >
                    <SectionHeader
                      title="Agent Owned"
                      count={filteredWorkspaceSkills.length}
                      open={openAgentOwned}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="w-full space-y-2 pt-2">
                  {filteredWorkspaceSkills.map((entry) => (
                    <div
                      key={`workspace-sidebar-${entry.skillId}`}
                      className={`w-full overflow-hidden rounded-md border px-3 py-3 text-left transition ${selectedSkillId === entry.skillId ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectSkill(entry.skillId)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="min-w-0 truncate text-sm font-medium">{entry.skillId}</p>
                        </button>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">workspace</Badge>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isMutatingWorkspace}
                            onClick={() => onToggleWorkspaceSkill(entry.skillId, false)}
                          >
                            Disable
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 truncate text-[11px] text-muted-foreground">
                        {entry.sourcePath}
                      </p>
                    </div>
                  ))}
                  {filteredWorkspaceSkills.length === 0 ? (
                    <p className="px-1 text-xs text-muted-foreground">
                      No agent-owned skills match the current search.
                    </p>
                  ) : null}
                </CollapsibleContent>
              </Collapsible>

              <Collapsible open={openGlobal} onOpenChange={setOpenGlobal} className="w-full pt-2">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="block w-full rounded-md border px-2 py-2 text-left hover:bg-muted/30"
                  >
                    <SectionHeader title="Global" count={globalInheritedSkills.length} open={openGlobal} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="w-full space-y-2 pt-2">
                  {globalInheritedSkills.map((entry) => {
                    const skillId = entry.skillKey || entry.name;
                    const equippedForAgent = isAgentSkillEquipped(skillId);
                    return (
                      <div
                        key={`inherited-sidebar-${skillId}`}
                        className={`w-full overflow-hidden rounded-md border px-3 py-3 text-left transition ${selectedSkillId === skillId ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectSkill(skillId)}
                          className="min-w-0 w-full text-left"
                        >
                          <p className="min-w-0 truncate text-sm font-medium">{skillId}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {entry.description || "Inherited runtime skill"}
                          </p>
                        </button>
                        <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground">
                            {equippedForAgent
                              ? "Enabled for this agent"
                              : "Disabled for this agent"}
                          </span>
                          <Button
                            size="sm"
                            variant={equippedForAgent ? "destructive" : "default"}
                            disabled={isSavingGlobalConfig}
                            onClick={() => onToggleAgentSkill(skillId)}
                          >
                            {equippedForAgent ? "Disable" : "Enable"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {globalInheritedSkills.length === 0 ? (
                    <p className="px-1 text-xs text-muted-foreground">
                      No global skills match the current search.
                    </p>
                  ) : null}
                </CollapsibleContent>
              </Collapsible>

              <Collapsible
                open={openBundled}
                onOpenChange={setOpenBundled}
                className="w-full py-2"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="block w-full rounded-md border px-2 py-2 text-left hover:bg-muted/30"
                  >
                    <SectionHeader
                      title="OpenClaw Bundled"
                      count={bundledInheritedSkills.length}
                      open={openBundled}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="w-full space-y-2 pt-2">
                  {bundledInheritedSkills.map((entry) => {
                    const skillId = entry.skillKey || entry.name;
                    const equippedForAgent = isAgentSkillEquipped(skillId);
                    return (
                      <div
                        key={`bundled-sidebar-${skillId}`}
                        className={`w-full overflow-hidden rounded-md border px-3 py-3 text-left transition ${selectedSkillId === skillId ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectSkill(skillId)}
                          className="min-w-0 w-full text-left"
                        >
                          <p className="min-w-0 truncate text-sm font-medium">{skillId}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {entry.description || "Bundled OpenClaw skill"}
                          </p>
                        </button>
                        <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground">
                            {equippedForAgent
                              ? "Enabled for this agent"
                              : "Disabled for this agent"}
                          </span>
                          <Button
                            size="sm"
                            variant={equippedForAgent ? "destructive" : "default"}
                            disabled={isSavingGlobalConfig}
                            onClick={() => onToggleAgentSkill(skillId)}
                          >
                            {equippedForAgent ? "Disable" : "Enable"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {bundledInheritedSkills.length === 0 ? (
                    <p className="px-1 text-xs text-muted-foreground">
                      No bundled skills match the current search.
                    </p>
                  ) : null}
                </CollapsibleContent>
              </Collapsible>
            </>
          ) : (
            <>
              <div className="w-full space-y-2 py-2">
              {filteredGlobalSkillRows.map((row) => {
                return (
                  <div
                    key={`global-runtime-${row.skillKey}`}
                    className={`w-full overflow-hidden rounded-md border px-3 py-3 text-left transition ${selectedSkillId === row.skillKey ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectSkill(row.skillKey)}
                      className="block min-w-0 w-full text-left"
                    >
                      <p className="min-w-0 truncate text-sm font-medium">{row.skillKey}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {describeGlobalSkillRow(row)}
                      </p>
                    </button>
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        variant={row.enabled === false ? "default" : "destructive"}
                        disabled={isSavingGlobalConfig}
                        onClick={() => onToggleGlobalSkill(row.skillKey, row.enabled === false)}
                      >
                        {row.enabled === false ? "Enable" : "Disable"}
                      </Button>
                    </div>
                  </div>
                );
              })}
              {filteredGlobalSkillRows.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">
                  No shared runtime skills or config entries match the current search.
                </p>
              ) : null}
              </div>
            </>
          )}
        </>
      </ScrollArea>
    </>
  );
}
