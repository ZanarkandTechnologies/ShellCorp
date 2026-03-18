"use client";

/**
 * SKILL STUDIO PANEL
 * ==================
 * Dedicated viewer/workbench for repo-local skills, demos, metadata, and files.
 *
 * KEY CONCEPTS:
 * - Global catalog lives on the left; selected skill details render on the right.
 * - Per-agent runtime context is optional and merged from `skills.status` when available.
 * - Metadata edits are limited to `skill.config.yaml`; `SKILL.md` remains read-only.
 *
 * MEMORY REFERENCES:
 * - MEM-0160
 * - MEM-0166
 * - MEM-0188
 * - MEM-0203
 * - MEM-0205
 */

import type { ReactElement } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkillsPanelControlsTab } from "@/features/office-system/components/skills-panel-controls-tab";
import { SkillsPanelDemosTab } from "@/features/office-system/components/skills-panel-demos-tab";
import { SkillsPanelDiagramTab } from "@/features/office-system/components/skills-panel-diagram-tab";
import { SkillsPanelFilesTab } from "@/features/office-system/components/skills-panel-files-tab";
import { SkillsPanelOverviewTab } from "@/features/office-system/components/skills-panel-overview-tab";
import { SkillsPanelSidebar } from "@/features/office-system/components/skills-panel-sidebar";
import { useSkillsPanelController } from "@/features/office-system/components/use-skills-panel-controller";
import { UI_Z } from "@/lib/z-index";

const SKILL_STUDIO_SIDEBAR_WIDTH = 380;

function EmptyState(): ReactElement {
  return (
    <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      Select a runtime skill to inspect its files, diagram, demos, and controls.
    </div>
  );
}

export function SkillsPanel(): ReactElement {
  const {
    isOpen,
    setIsOpen,
    focusAgentId,
    selectedSkillId,
    setSelectedSkillId,
    search,
    setSearch,
    flagFilter,
    setFlagFilter,
    errorText,
    activeTab,
    setActiveTab,
    selectOverlayStyle,
    runtimeStatusText,
    filteredWorkspaceSkills,
    groupedInheritedRuntimeSkills,
    filteredGlobalSkillRows,
    isSavingGlobalConfig,
    isMutatingWorkspace,
    isAgentSkillEquipped,
    selection,
    fileState,
    demoState,
    manifestState,
    agentWorkspacePath,
    selectedDemoTitle,
    diagramDocument,
    splitLines,
    getDemoStepKey,
    refreshRuntimeView,
    handleToggleGlobalSkill,
    handleToggleAgentSkill,
    handleWorkspaceSkillToggle,
    handleSaveManifest,
    updateManifest,
    setEditorMode,
    setRawManifest,
    setSelectedFilePath,
    setFileDraft,
    handleSaveFile,
    setSelectedDemoId,
    handleRunDemo,
  } = useSkillsPanelController();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="flex h-[92vh] min-w-[88vw] max-w-none flex-col gap-0 overflow-hidden p-0"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{focusAgentId ? "Agent Skills" : "Global Skills"}</DialogTitle>
          {focusAgentId ? (
            <p className="text-xs text-muted-foreground">Focused agent: {focusAgentId}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Shared OpenClaw skills on the left. Inspect files, diagrams, demos, and controls in
              the viewer.
            </p>
          )}
          {errorText ? <p className="text-xs text-destructive">{errorText}</p> : null}
        </DialogHeader>
        <div
          className="grid min-h-0 flex-1 overflow-hidden"
          style={{ gridTemplateColumns: `${SKILL_STUDIO_SIDEBAR_WIDTH}px minmax(0, 1fr)` }}
        >
          <div className="flex min-h-0 flex-col border-r p-4">
            <div className="flex items-center gap-2">
              <Input
                className="flex-1"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search skills"
              />
              <Select value={flagFilter} onValueChange={setFlagFilter}>
                <SelectTrigger className="w-[104px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent style={selectOverlayStyle}>
                  <SelectItem value="all">Filter</SelectItem>
                  <SelectItem value="has-tests">Tests</SelectItem>
                  <SelectItem value="has-diagram">Diagram</SelectItem>
                  <SelectItem value="skill-memory">Memory</SelectItem>
                  <SelectItem value="runtime-eligible">Eligible</SelectItem>
                  <SelectItem value="runtime-blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SkillsPanelSidebar
              focusAgentId={focusAgentId}
              runtimeStatusText={runtimeStatusText}
              selectedSkillId={selectedSkillId}
              filteredWorkspaceSkills={filteredWorkspaceSkills}
              groupedInheritedRuntimeSkills={groupedInheritedRuntimeSkills}
              filteredGlobalSkillRows={filteredGlobalSkillRows}
              isSavingGlobalConfig={isSavingGlobalConfig}
              isMutatingWorkspace={isMutatingWorkspace}
              isAgentSkillEquipped={isAgentSkillEquipped}
              onRefresh={() => void refreshRuntimeView()}
              onSelectSkill={(skillId) => setSelectedSkillId(skillId)}
              onToggleGlobalSkill={(skillKey, enabled) =>
                void handleToggleGlobalSkill(skillKey, enabled)
              }
              onToggleAgentSkill={(skillId) => void handleToggleAgentSkill(skillId)}
              onToggleWorkspaceSkill={(skillId, install) =>
                void handleWorkspaceSkillToggle(skillId, install)
              }
            />
          </div>

          <div className="min-h-0 min-w-0 overflow-hidden p-4">
            {!selection.selectedDetail || !manifestState.manifestEditor ? (
              <EmptyState />
            ) : (
              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as typeof activeTab)}
                className="flex h-full min-h-0 flex-col"
              >
                <TabsList className="shrink-0">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="files">Files</TabsTrigger>
                  <TabsTrigger value="diagram">Diagram</TabsTrigger>
                  <TabsTrigger value="demos">Demos</TabsTrigger>
                  <TabsTrigger value="controls">Controls</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="min-h-0 flex-1 overflow-hidden">
                  <SkillsPanelOverviewTab
                    focusAgentId={focusAgentId}
                    selection={selection}
                    isSavingGlobalConfig={isSavingGlobalConfig}
                    isMutatingWorkspace={isMutatingWorkspace}
                    onToggleWorkspaceSkill={(skillId, install) =>
                      void handleWorkspaceSkillToggle(skillId, install)
                    }
                    onToggleAgentSkill={(skillId) => void handleToggleAgentSkill(skillId)}
                    onToggleGlobalSkill={(skillId, enabled) =>
                      void handleToggleGlobalSkill(skillId, enabled)
                    }
                    onOpenControls={() => setActiveTab("controls")}
                  />
                </TabsContent>

                <TabsContent value="controls" className="min-h-0 flex-1 overflow-hidden">
                  <SkillsPanelControlsTab
                    focusAgentId={focusAgentId}
                    agentWorkspacePath={agentWorkspacePath}
                    selection={selection}
                    manifestState={manifestState}
                    isSavingGlobalConfig={isSavingGlobalConfig}
                    isMutatingWorkspace={isMutatingWorkspace}
                    selectOverlayStyle={selectOverlayStyle}
                    onSetEditorMode={setEditorMode}
                    onSaveManifest={() => void handleSaveManifest()}
                    onUpdateManifest={updateManifest}
                    onChangeRawManifest={setRawManifest}
                    onToggleWorkspaceSkill={(skillId, install) =>
                      void handleWorkspaceSkillToggle(skillId, install)
                    }
                    onToggleAgentSkill={(skillId) => void handleToggleAgentSkill(skillId)}
                    onToggleGlobalSkill={(skillId, enabled) =>
                      void handleToggleGlobalSkill(skillId, enabled)
                    }
                    splitLines={splitLines}
                  />
                </TabsContent>

                <TabsContent value="files" className="min-h-0 flex-1 overflow-hidden">
                  <SkillsPanelFilesTab
                    selection={selection}
                    fileState={fileState}
                    onSelectFilePath={setSelectedFilePath}
                    onChangeFileDraft={setFileDraft}
                    onSaveFile={() => void handleSaveFile()}
                  />
                </TabsContent>

                <TabsContent value="diagram" className="min-h-0 flex-1 overflow-hidden">
                  <SkillsPanelDiagramTab selection={selection} diagramDocument={diagramDocument} />
                </TabsContent>

                <TabsContent value="demos" className="min-h-0 flex-1 overflow-hidden">
                  <SkillsPanelDemosTab
                    selection={selection}
                    demoState={demoState}
                    selectedDemoTitle={selectedDemoTitle}
                    getDemoStepKey={getDemoStepKey}
                    onSelectDemoId={(demoId) => setSelectedDemoId(demoId)}
                    onRunDemo={() => void handleRunDemo()}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
