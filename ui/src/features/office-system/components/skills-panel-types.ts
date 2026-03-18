/**
 * SKILLS PANEL TYPES
 * ==================
 * Shared prop and view types for the refactored Skills panel surfaces.
 *
 * KEY CONCEPTS:
 * - The root panel owns loading and mutations.
 * - Child components stay render-focused and receive derived state via props.
 *
 * USAGE:
 * - Imported by the Skills panel container and child tab/sidebar components.
 *
 * MEMORY REFERENCES:
 * - MEM-0205
 */

import type {
  AgentSkillsInventory,
  GlobalSkillsInventory,
  SkillDemoRunResult,
  SkillManifest,
  SkillStatusReport,
  SkillStudioDetail,
  SkillStudioFileContent,
} from "@/lib/openclaw-types";
import type { GlobalSkillRow } from "./skills-panel.runtime";

export type DetailTab = "overview" | "files" | "diagram" | "demos" | "controls";

export type InheritedRuntimeSkillEntry = NonNullable<SkillStatusReport["skills"][number]>;

export type GroupedInheritedRuntimeSkills = Array<
  [label: string, entries: InheritedRuntimeSkillEntry[]]
>;

export type SkillsPanelSharedState = {
  focusAgentId: string | null;
  runtimeStatusText: string;
  isSavingGlobalConfig: boolean;
  isMutatingWorkspace: boolean;
};

export type SkillsPanelSelectionState = {
  selectedDetail: SkillStudioDetail | null;
  selectedGlobalSkillRow: GlobalSkillRow | null;
  selectedSharedSkillEntry: GlobalSkillsInventory["sharedSkills"][number] | null;
  selectedInheritedRuntimeSkill: InheritedRuntimeSkillEntry | null;
  selectedWorkspaceSkillEntry: AgentSkillsInventory["workspaceSkills"][number] | null;
  selectedSkillInstalledInWorkspace: boolean;
  selectedAgentSkillEnabled: boolean;
  runtimeStatus: SkillStatusReport["skills"][number] | null;
};

export type SkillsPanelFileState = {
  selectedFilePath: string | null;
  selectedFile: SkillStudioFileContent | null;
  fileDraft: string;
  fileSaveStatus: string;
  isSavingFile: boolean;
};

export type SkillsPanelDemoState = {
  selectedDemoId: string | null;
  lastDemoRun: SkillDemoRunResult | null;
  isRunningDemo: boolean;
};

export type SkillsPanelManifestState = {
  manifestEditor: SkillManifest | null;
  rawManifest: string;
  editorMode: "structured" | "raw";
  saveStatus: string;
  canSave: boolean;
  isSaving: boolean;
  readPathsText: string;
  writePathsText: string;
  dependencySkillsText: string;
  dependencyDocsText: string;
  referencesText: string;
};
