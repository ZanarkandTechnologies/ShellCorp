/**
 * SKILLS PANEL OVERVIEW TAB
 * =========================
 * Renders the selected skill summary and top-level actions.
 *
 * KEY CONCEPTS:
 * - Overview is read-first and keeps actions close to the selected skill header.
 * - Container-owned callbacks handle all mutations.
 *
 * USAGE:
 * - Rendered inside `skills-panel.tsx`.
 *
 * MEMORY REFERENCES:
 * - MEM-0205
 */

import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatTimestamp as fmtTs } from "@/lib/format-utils";
import type { SkillsPanelSelectionState } from "./skills-panel-types";

type Props = {
  focusAgentId: string | null;
  selection: SkillsPanelSelectionState;
  isSavingGlobalConfig: boolean;
  isMutatingWorkspace: boolean;
  onToggleWorkspaceSkill: (skillId: string, install: boolean) => void;
  onToggleAgentSkill: (skillId: string) => void;
  onToggleGlobalSkill: (skillId: string, enabled: boolean) => void;
  onOpenControls: () => void;
};

export function SkillsPanelOverviewTab({
  focusAgentId,
  selection,
  isSavingGlobalConfig,
  isMutatingWorkspace,
  onToggleWorkspaceSkill,
  onToggleAgentSkill,
  onToggleGlobalSkill,
  onOpenControls,
}: Props): ReactElement {
  const {
    selectedDetail,
    selectedSharedSkillEntry,
    selectedWorkspaceSkillEntry,
    selectedInheritedRuntimeSkill,
    selectedGlobalSkillRow,
    selectedSkillInstalledInWorkspace,
    selectedAgentSkillEnabled,
    runtimeStatus,
  } = selection;

  if (!selectedDetail) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Select a runtime skill to inspect its files, diagram, demos, and controls.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full min-h-0 rounded-md border p-4">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold">{selectedDetail.displayName}</h3>
            <p className="break-words text-sm text-muted-foreground">
              {selectedDetail.description || selectedDetail.skillId}
            </p>
            <p className="mt-1 break-all text-xs text-muted-foreground">
              {selectedDetail.sourcePath}
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <Badge variant="secondary">{selectedDetail.category}</Badge>
            {selectedSharedSkillEntry ? <Badge variant="secondary">shared</Badge> : null}
            {selectedWorkspaceSkillEntry ? <Badge variant="secondary">workspace</Badge> : null}
            {selectedInheritedRuntimeSkill ? <Badge variant="outline">inherited</Badge> : null}
            {selectedDetail.hasManifest ? <Badge variant="outline">manifest</Badge> : null}
            {selectedDetail.manifest.state.mode === "skill_memory" ? (
              <Badge variant="outline">skill memory</Badge>
            ) : null}
            {runtimeStatus?.eligible ? <Badge variant="secondary">eligible</Badge> : null}
            {runtimeStatus?.blockedByAllowlist ? (
              <Badge variant="destructive">blocked by allowlist</Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {focusAgentId ? (
            selectedWorkspaceSkillEntry ? (
              <Button
                size="sm"
                variant="destructive"
                disabled={isMutatingWorkspace}
                onClick={() => onToggleWorkspaceSkill(selectedDetail.skillId, false)}
              >
                {isMutatingWorkspace ? "Applying..." : "Disable For Agent"}
              </Button>
            ) : selectedInheritedRuntimeSkill ? (
              <Button
                size="sm"
                variant={selectedAgentSkillEnabled ? "destructive" : "default"}
                disabled={isSavingGlobalConfig}
                onClick={() => onToggleAgentSkill(selectedDetail.skillId)}
              >
                {selectedAgentSkillEnabled ? "Disable For Agent" : "Enable For Agent"}
              </Button>
            ) : null
          ) : (
            <Button
              size="sm"
              variant={selectedGlobalSkillRow?.enabled === false ? "default" : "destructive"}
              disabled={isSavingGlobalConfig}
              onClick={() =>
                onToggleGlobalSkill(selectedDetail.skillId, selectedGlobalSkillRow?.enabled === false)
              }
            >
              {selectedGlobalSkillRow?.enabled === false ? "Enable" : "Disable"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onOpenControls}>
            Open controls
          </Button>
        </div>

        <div className="space-y-3">
          <div className="rounded-md border px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Runtime
            </p>
            <div className="mt-2 space-y-1">
              <p>Updated: {selectedDetail.updatedAt ? fmtTs(selectedDetail.updatedAt) : "n/a"}</p>
              <p>Scope: {focusAgentId ? `agent-aware (${focusAgentId})` : "shared runtime"}</p>
              <p>
                Status:{" "}
                {runtimeStatus?.blockedByAllowlist
                  ? "blocked"
                  : runtimeStatus
                    ? "allowed"
                    : "n/a"}
              </p>
            </div>
          </div>
          <div className="rounded-md border px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Summary
            </p>
            <div className="mt-2 space-y-1">
              <p>
                Requirements:{" "}
                {runtimeStatus
                  ? `${runtimeStatus.requirements.env.length} env, ${runtimeStatus.requirements.bins.length} bins, ${runtimeStatus.requirements.config.length} config`
                  : "n/a"}
              </p>
              {focusAgentId ? (
                <p>
                  Workspace install: {selectedSkillInstalledInWorkspace ? "installed" : "not installed"}
                </p>
              ) : (
                <p>
                  Shared install: {selectedGlobalSkillRow?.hasSharedInstall ? "present" : "not installed"}
                </p>
              )}
              <p>Use `Files`, `Diagram`, `Demos`, or `Controls` for deeper work.</p>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
