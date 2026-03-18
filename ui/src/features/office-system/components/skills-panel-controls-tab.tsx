/**
 * SKILLS PANEL CONTROLS TAB
 * =========================
 * Renders runtime scope controls and manifest editing for the selected skill.
 *
 * MEMORY REFERENCES:
 * - MEM-0166
 * - MEM-0205
 */

import type { CSSProperties, ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { SkillManifest } from "@/lib/openclaw-types";
import type {
  SkillsPanelManifestState,
  SkillsPanelSelectionState,
} from "./skills-panel-types";

type Props = {
  focusAgentId: string | null;
  agentWorkspacePath: string | null;
  selection: SkillsPanelSelectionState;
  manifestState: SkillsPanelManifestState;
  isSavingGlobalConfig: boolean;
  isMutatingWorkspace: boolean;
  selectOverlayStyle: CSSProperties;
  onSetEditorMode: (mode: "structured" | "raw") => void;
  onSaveManifest: () => void;
  onUpdateManifest: (next: Partial<SkillManifest>) => void;
  onChangeRawManifest: (value: string) => void;
  onToggleWorkspaceSkill: (skillId: string, install: boolean) => void;
  onToggleAgentSkill: (skillId: string) => void;
  onToggleGlobalSkill: (skillId: string, enabled: boolean) => void;
  splitLines: (text: string) => string[];
};

export function SkillsPanelControlsTab({
  focusAgentId,
  agentWorkspacePath,
  selection,
  manifestState,
  isSavingGlobalConfig,
  isMutatingWorkspace,
  selectOverlayStyle,
  onSetEditorMode,
  onSaveManifest,
  onUpdateManifest,
  onChangeRawManifest,
  onToggleWorkspaceSkill,
  onToggleAgentSkill,
  onToggleGlobalSkill,
  splitLines,
}: Props): ReactElement {
  const {
    selectedDetail,
    selectedGlobalSkillRow,
    selectedSharedSkillEntry,
    selectedInheritedRuntimeSkill,
    selectedWorkspaceSkillEntry,
    selectedSkillInstalledInWorkspace,
    selectedAgentSkillEnabled,
    runtimeStatus,
  } = selection;
  const {
    manifestEditor,
    rawManifest,
    editorMode,
    saveStatus,
    canSave,
    isSaving,
    readPathsText,
    writePathsText,
    dependencySkillsText,
    dependencyDocsText,
    referencesText,
  } = manifestState;

  if (!selectedDetail || !manifestEditor) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Select a runtime skill to inspect its files, diagram, demos, and controls.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full min-h-0 rounded-md border p-4">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Runtime Scope</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {focusAgentId ? (
              <>
                <p>Agent: {focusAgentId}</p>
                <p>Workspace path: {agentWorkspacePath || "n/a"}</p>
                <p>Workspace install: {selectedSkillInstalledInWorkspace ? "installed" : "not installed"}</p>
                <p>Inherited shared/runtime: {selectedInheritedRuntimeSkill ? "yes" : "no"}</p>
                <div className="pt-2">
                  {selectedWorkspaceSkillEntry ? (
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
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      This skill is inherited from runtime. Use the agent toggle here or manage instance-wide state from Global Skills.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <p>Shared install: {selectedGlobalSkillRow?.hasSharedInstall ? "present" : "not installed"}</p>
                <p>Shared path: {selectedSharedSkillEntry?.sourcePath || "n/a"}</p>
                <p>Env entries: {selectedGlobalSkillRow?.envCount ?? 0}</p>
                <p>Config entries: {selectedGlobalSkillRow?.configCount ?? 0}</p>
                <div className="pt-2">
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
                </div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Config Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              {focusAgentId ? "Enabled For Agent" : "Enabled"}:{" "}
              {focusAgentId
                ? selectedAgentSkillEnabled
                  ? "yes"
                  : "no"
                : selectedGlobalSkillRow
                  ? selectedGlobalSkillRow.enabled === false
                    ? "no"
                    : "yes"
                  : "n/a"}
            </p>
            <p>
              Runtime source:{" "}
              {runtimeStatus?.source ||
                (selectedWorkspaceSkillEntry
                  ? "workspace"
                  : selectedSharedSkillEntry
                    ? "shared"
                    : "repo")}
            </p>
            <p>
              Allowlist state:{" "}
              {runtimeStatus?.blockedByAllowlist ? "blocked" : runtimeStatus ? "allowed" : "n/a"}
            </p>
            <p>
              Requirements:{" "}
              {runtimeStatus
                ? `${runtimeStatus.requirements.env.length} env, ${runtimeStatus.requirements.bins.length} bins, ${runtimeStatus.requirements.config.length} config`
                : "n/a"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Metadata Editor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedDetail.hasManifest ? (
              <p className="text-sm text-muted-foreground">
                This runtime-only skill does not expose a repo-backed manifest here.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={editorMode === "structured" ? "default" : "outline"}
                size="sm"
                onClick={() => onSetEditorMode("structured")}
                disabled={!selectedDetail.hasManifest}
              >
                Structured
              </Button>
              <Button
                variant={editorMode === "raw" ? "default" : "outline"}
                size="sm"
                onClick={() => onSetEditorMode("raw")}
                disabled={!selectedDetail.hasManifest}
              >
                Raw YAML
              </Button>
              <Button size="sm" onClick={onSaveManifest} disabled={!canSave}>
                {isSaving ? "Saving..." : "Save metadata"}
              </Button>
              {saveStatus ? <span className="text-xs text-muted-foreground">{saveStatus}</span> : null}
            </div>

            {!selectedDetail.hasManifest ? null : editorMode === "structured" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    value={manifestEditor.interface.displayName}
                    onChange={(event) =>
                      onUpdateManifest({
                        interface: {
                          ...manifestEditor.interface,
                          displayName: event.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Brand Color</Label>
                  <Input
                    value={manifestEditor.interface.brandColor ?? ""}
                    onChange={(event) =>
                      onUpdateManifest({
                        interface: {
                          ...manifestEditor.interface,
                          brandColor: event.target.value || undefined,
                        },
                      })
                    }
                  />
                </div>
                <div className="min-w-0 space-y-2 lg:col-span-2">
                  <Label>Short Description</Label>
                  <Textarea
                    value={manifestEditor.interface.shortDescription}
                    onChange={(event) =>
                      onUpdateManifest({
                        interface: {
                          ...manifestEditor.interface,
                          shortDescription: event.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="min-w-0 space-y-2 lg:col-span-2">
                  <Label>Default Prompt</Label>
                  <Textarea
                    value={manifestEditor.interface.defaultPrompt ?? ""}
                    onChange={(event) =>
                      onUpdateManifest({
                        interface: {
                          ...manifestEditor.interface,
                          defaultPrompt: event.target.value || undefined,
                        },
                      })
                    }
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>State Mode</Label>
                  <Select
                    value={manifestEditor.state.mode}
                    onValueChange={(value) =>
                      onUpdateManifest({
                        state: {
                          ...manifestEditor.state,
                          mode: value as SkillManifest["state"]["mode"],
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={selectOverlayStyle}>
                      <SelectItem value="stateless">stateless</SelectItem>
                      <SelectItem value="agent_memory">agent_memory</SelectItem>
                      <SelectItem value="skill_memory">skill_memory</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Memory File</Label>
                  <Input
                    value={manifestEditor.state.memoryFile ?? ""}
                    onChange={(event) =>
                      onUpdateManifest({
                        state: {
                          ...manifestEditor.state,
                          memoryFile: event.target.value || undefined,
                        },
                      })
                    }
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Read Paths</Label>
                  <Textarea
                    value={readPathsText}
                    onChange={(event) =>
                      onUpdateManifest({
                        paths: {
                          ...manifestEditor.paths,
                          read: splitLines(event.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Write Paths</Label>
                  <Textarea
                    value={writePathsText}
                    onChange={(event) =>
                      onUpdateManifest({
                        paths: {
                          ...manifestEditor.paths,
                          write: splitLines(event.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Related Skills</Label>
                  <Textarea
                    value={dependencySkillsText}
                    onChange={(event) =>
                      onUpdateManifest({
                        dependencies: {
                          ...manifestEditor.dependencies,
                          skills: splitLines(event.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Docs</Label>
                  <Textarea
                    value={dependencyDocsText}
                    onChange={(event) =>
                      onUpdateManifest({
                        dependencies: {
                          ...manifestEditor.dependencies,
                          docs: splitLines(event.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div className="min-w-0 space-y-2 lg:col-span-2">
                  <Label>References</Label>
                  <Textarea
                    value={referencesText}
                    onChange={(event) =>
                      onUpdateManifest({ references: splitLines(event.target.value) })
                    }
                  />
                </div>
              </div>
            ) : (
              <Textarea
                className="min-h-[28rem] font-mono text-xs"
                value={rawManifest}
                onChange={(event) => onChangeRawManifest(event.target.value)}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
