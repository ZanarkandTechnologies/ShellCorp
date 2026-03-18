"use client";

/**
 * USE SKILLS PANEL CONTROLLER
 * ===========================
 * Central controller for the Skills panel data-loading, mutations, and derived view state.
 *
 * KEY CONCEPTS:
 * - The dialog shell stays render-focused while this hook owns polling and mutations.
 * - Repo skill catalog state and runtime availability stay separate per MEM-0203.
 * - Skill mutation success messages land only after runtime refresh completes per MEM-0205.
 *
 * USAGE:
 * - Imported by `skills-panel.tsx`.
 *
 * MEMORY REFERENCES:
 * - MEM-0203
 * - MEM-0205
 */

import { useEffect, useMemo, useState } from "react";
import {
  buildNextAgentConfig,
  resolveAgentConfigDraft,
} from "@/features/office-system/components/manage-agent-modal/config-draft";
import {
  isSkillEquipped,
  toggleSidebarSkill,
} from "@/features/office-system/components/skills-panel.helpers";
import {
  buildGlobalSkillRows,
  buildInheritedRuntimeSkillKeys,
  buildNextGlobalSkillConfig,
} from "@/features/office-system/components/skills-panel.runtime";
import {
  buildKnownAgentSkillIds,
  buildMermaidDocument,
  buildRuntimeOnlySkillDetail,
  buildVisibleGlobalSkillRows,
  findRuntimeStatusForDetail,
  getDemoStepKey,
  groupInheritedRuntimeSkills,
  joinLines,
  mergeRuntimeStatus,
  splitLines,
  toManifestDraft,
} from "@/features/office-system/components/skills-panel-data";
import type {
  DetailTab,
  SkillsPanelDemoState,
  SkillsPanelFileState,
  SkillsPanelManifestState,
  SkillsPanelSelectionState,
} from "@/features/office-system/components/skills-panel-types";
import { usePollWithInterval } from "@/hooks/use-poll-with-interval";
import { useAppStore } from "@/lib/app-store";
import type {
  AgentSkillsInventory,
  GlobalSkillsInventory,
  SkillDemoRunResult,
  SkillManifest,
  SkillStatusReport,
  SkillStudioCatalogEntry,
  SkillStudioDetail,
  SkillStudioFileContent,
} from "@/lib/openclaw-types";
import { stringifySkillManifest } from "@/lib/skill-studio";
import { UI_Z } from "@/lib/z-index";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";

type ControllerResult = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  focusAgentId: string | null;
  selectedSkillId: string | null;
  setSelectedSkillId: (skillId: string | null) => void;
  search: string;
  setSearch: (value: string) => void;
  flagFilter: string;
  setFlagFilter: (value: string) => void;
  errorText: string;
  activeTab: DetailTab;
  setActiveTab: (tab: DetailTab) => void;
  selectOverlayStyle: { zIndex: number };
  runtimeStatusText: string;
  filteredWorkspaceSkills: AgentSkillsInventory["workspaceSkills"];
  groupedInheritedRuntimeSkills: ReturnType<typeof groupInheritedRuntimeSkills>;
  filteredGlobalSkillRows: ReturnType<typeof buildVisibleGlobalSkillRows>;
  isSavingGlobalConfig: boolean;
  isMutatingWorkspace: boolean;
  isAgentSkillEquipped: (skillId: string) => boolean;
  selection: SkillsPanelSelectionState;
  fileState: SkillsPanelFileState;
  demoState: SkillsPanelDemoState;
  manifestState: SkillsPanelManifestState;
  agentWorkspacePath: string | null;
  selectedDemoTitle: string | null;
  diagramDocument: string | null;
  splitLines: (text: string) => string[];
  getDemoStepKey: typeof getDemoStepKey;
  refreshRuntimeView: () => Promise<void>;
  handleToggleGlobalSkill: (skillKey: string, enabled: boolean) => Promise<void>;
  handleToggleAgentSkill: (skillId: string) => Promise<void>;
  handleWorkspaceSkillToggle: (skillId: string, install: boolean) => Promise<void>;
  handleSaveManifest: () => Promise<void>;
  updateManifest: (next: Partial<SkillManifest>) => void;
  setEditorMode: (mode: "structured" | "raw") => void;
  setRawManifest: (value: string) => void;
  setSelectedFilePath: (path: string | null) => void;
  setFileDraft: (value: string) => void;
  handleSaveFile: () => Promise<void>;
  setSelectedDemoId: (demoId: string | null) => void;
  handleRunDemo: () => Promise<void>;
};

export function useSkillsPanelController(): ControllerResult {
  const isOpen = useAppStore((state) => state.isSkillsPanelOpen);
  const setIsOpen = useAppStore((state) => state.setIsSkillsPanelOpen);
  const selectedSkillId = useAppStore((state) => state.selectedSkillStudioSkillId);
  const setSelectedSkillId = useAppStore((state) => state.setSelectedSkillStudioSkillId);
  const focusAgentId = useAppStore((state) => state.skillStudioFocusAgentId);
  const adapter = useOpenClawAdapter();

  const [skills, setSkills] = useState<SkillStudioCatalogEntry[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<SkillStudioDetail | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<SkillStudioFileContent | null>(null);
  const [fileDraft, setFileDraft] = useState("");
  const [fileSaveStatus, setFileSaveStatus] = useState("");
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [selectedDemoId, setSelectedDemoId] = useState<string | null>(null);
  const [lastDemoRun, setLastDemoRun] = useState<SkillDemoRunResult | null>(null);
  const [skillsReport, setSkillsReport] = useState<SkillStatusReport | null>(null);
  const [agentInventory, setAgentInventory] = useState<AgentSkillsInventory | null>(null);
  const [globalInventory, setGlobalInventory] = useState<GlobalSkillsInventory | null>(null);
  const [configSnapshot, setConfigSnapshot] = useState<Record<string, unknown> | null>(null);
  const [search, setSearch] = useState("");
  const [flagFilter, setFlagFilter] = useState("all");
  const [errorText, setErrorText] = useState("");
  const [manifestDraft, setManifestDraft] = useState<SkillManifest | null>(null);
  const [rawManifest, setRawManifest] = useState("");
  const [editorMode, setEditorMode] = useState<"structured" | "raw">("structured");
  const [saveStatus, setSaveStatus] = useState("");
  const [runtimeStatusText, setRuntimeStatusText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isMutatingWorkspace, setIsMutatingWorkspace] = useState(false);
  const [isSavingGlobalConfig, setIsSavingGlobalConfig] = useState(false);
  const [isRunningDemo, setIsRunningDemo] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const selectOverlayStyle = useMemo(() => ({ zIndex: UI_Z.panelModal + 1 }), []);

  usePollWithInterval(
    async (signal) => {
      if (!isOpen) return;
      try {
        const [catalog, report, nextAgentInventory, nextGlobalInventory, snapshot] =
          await Promise.all([
            adapter.listSkillStudioCatalog(),
            focusAgentId ? adapter.getSkillsStatus(focusAgentId) : Promise.resolve(null),
            focusAgentId ? adapter.getAgentSkillsInventory(focusAgentId) : Promise.resolve(null),
            focusAgentId ? Promise.resolve(null) : adapter.getGlobalSkillsInventory(),
            adapter.getConfigSnapshot().catch(() => null),
          ]);
        if (signal.cancelled) return;
        setSkills(mergeRuntimeStatus(catalog, report));
        setSkillsReport(report);
        setAgentInventory(nextAgentInventory);
        setGlobalInventory(nextGlobalInventory);
        setConfigSnapshot(snapshot?.config ?? null);
        const nextSelectedId = selectedSkillId ?? catalog[0]?.skillId ?? null;
        if (nextSelectedId && nextSelectedId !== selectedSkillId) {
          setSelectedSkillId(nextSelectedId);
        }
      } catch (error) {
        if (!signal.cancelled) {
          setErrorText(error instanceof Error ? error.message : "skills_load_failed");
        }
      }
    },
    10_000,
    [adapter, focusAgentId, isOpen, selectedSkillId, setSelectedSkillId],
  );

  useEffect(() => {
    const scopeKey = focusAgentId ?? "__global__";
    if (!isOpen) return;
    void scopeKey;
    setActiveTab("overview");
  }, [focusAgentId, isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedSkillId) return;
    let cancelled = false;
    const skillId = selectedSkillId;
    async function loadDetail(): Promise<void> {
      const catalogEntry = skills.find((entry) => entry.skillId === skillId) ?? null;
      const runtimeEntry =
        skillsReport?.skills.find(
          (entry) => entry.name === skillId || entry.skillKey === skillId,
        ) ?? null;
      const sharedEntry =
        globalInventory?.sharedSkills.find((entry) => entry.skillId === skillId) ?? null;
      try {
        const detail = await adapter.getSkillStudioDetail(skillId, focusAgentId ?? undefined);
        if (cancelled || !detail) return;
        const runtimeStatus =
          skillsReport?.skills.find(
            (entry) => entry.name === detail.skillId || entry.skillKey === detail.skillId,
          ) ?? undefined;
        const nextDetail = runtimeStatus ? { ...detail, runtimeStatus } : detail;
        setSelectedDetail(nextDetail);
        setManifestDraft(toManifestDraft(nextDetail));
        const configFile = await adapter
          .getSkillStudioFile(skillId, "skill.config.yaml")
          .catch(() => null);
        setRawManifest(configFile?.content ?? stringifySkillManifest(nextDetail.manifest));
        setSelectedFilePath(nextDetail.fileEntries[0]?.path ?? null);
        setSelectedDemoId(nextDetail.demoCases[0]?.id ?? null);
        setLastDemoRun(null);
        setSaveStatus("");
        setErrorText("");
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "skill_detail_failed";
        if (message.includes(":404")) {
          const fallback = buildRuntimeOnlySkillDetail({
            skillId,
            catalogEntry,
            runtimeStatus: runtimeEntry,
            sharedEntry,
            focusAgentId,
          });
          setSelectedDetail(fallback);
          setManifestDraft(toManifestDraft(fallback));
          setRawManifest(stringifySkillManifest(fallback.manifest));
          setSelectedFilePath(null);
          setSelectedDemoId(null);
          setLastDemoRun(null);
          setSaveStatus("");
          setErrorText("");
          return;
        }
        setErrorText(message);
      }
    }
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [adapter, focusAgentId, globalInventory, isOpen, selectedSkillId, skills, skillsReport]);

  useEffect(() => {
    if (!selectedDetail || !selectedFilePath) {
      setSelectedFile(null);
      setFileDraft("");
      return;
    }
    let cancelled = false;
    const skillId = selectedDetail.skillId;
    const filePath = selectedFilePath;
    async function loadFile(): Promise<void> {
      const file = await adapter.getSkillStudioFile(skillId, filePath);
      if (!cancelled) {
        setSelectedFile(file);
        setFileDraft(file?.isText ? (file.content ?? "") : "");
        setFileSaveStatus("");
      }
    }
    void loadFile();
    return () => {
      cancelled = true;
    };
  }, [adapter, selectedDetail, selectedFilePath]);

  const runtimeSearch = search.trim().toLowerCase();
  const selectedDemo = useMemo(
    () => selectedDetail?.demoCases.find((entry) => entry.id === selectedDemoId) ?? null,
    [selectedDemoId, selectedDetail],
  );
  const selectedDemoTitle = selectedDemo?.title ?? null;
  const diagramDocument = useMemo(
    () => (selectedDetail?.mermaid ? buildMermaidDocument(selectedDetail.mermaid) : null),
    [selectedDetail],
  );
  const runtimeStatus = useMemo(
    () => selectedDetail?.runtimeStatus ?? findRuntimeStatusForDetail(skillsReport, selectedDetail),
    [selectedDetail, skillsReport],
  );
  const manifestEditor = manifestDraft;
  const readPathsText = manifestEditor ? joinLines(manifestEditor.paths.read) : "";
  const writePathsText = manifestEditor ? joinLines(manifestEditor.paths.write) : "";
  const dependencySkillsText = manifestEditor ? joinLines(manifestEditor.dependencies.skills) : "";
  const dependencyDocsText = manifestEditor ? joinLines(manifestEditor.dependencies.docs) : "";
  const referencesText = manifestEditor ? joinLines(manifestEditor.references) : "";
  const canSave = Boolean(selectedDetail?.hasManifest && manifestEditor && !isSaving);
  const workspaceSkillIds = useMemo(
    () => new Set((agentInventory?.workspaceSkills ?? []).map((entry) => entry.skillId)),
    [agentInventory],
  );
  const inheritedRuntimeSkills = useMemo(() => {
    const keys = buildInheritedRuntimeSkillKeys(skillsReport, workspaceSkillIds);
    return keys
      .map((key) => skillsReport?.skills.find((entry) => (entry.skillKey || entry.name) === key))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
  }, [skillsReport, workspaceSkillIds]);
  const globalSkillRows = useMemo(
    () => buildGlobalSkillRows(configSnapshot, globalInventory),
    [configSnapshot, globalInventory],
  );
  const filteredWorkspaceSkills = useMemo(
    () =>
      (agentInventory?.workspaceSkills ?? []).filter((entry) =>
        entry.skillId.toLowerCase().includes(runtimeSearch),
      ),
    [agentInventory, runtimeSearch],
  );
  const filteredInheritedRuntimeSkills = useMemo(
    () =>
      inheritedRuntimeSkills.filter((entry) =>
        `${entry.skillKey || entry.name} ${entry.description} ${entry.source}`
          .toLowerCase()
          .includes(runtimeSearch),
      ),
    [inheritedRuntimeSkills, runtimeSearch],
  );
  const groupedInheritedRuntimeSkills = useMemo(
    () => groupInheritedRuntimeSkills(filteredInheritedRuntimeSkills),
    [filteredInheritedRuntimeSkills],
  );
  const filteredGlobalSkillRows = useMemo(
    () =>
      buildVisibleGlobalSkillRows(
        globalSkillRows,
        globalInventory?.sharedSkills ?? [],
        runtimeSearch,
      ),
    [globalInventory, globalSkillRows, runtimeSearch],
  );
  const knownAgentSkillIds = useMemo(
    () =>
      buildKnownAgentSkillIds({
        skills,
        workspaceSkills: agentInventory?.workspaceSkills ?? [],
        inheritedRuntimeSkills,
        selectedDetail,
      }),
    [agentInventory, inheritedRuntimeSkills, selectedDetail, skills],
  );
  const agentConfigDraft = useMemo(
    () => (focusAgentId ? resolveAgentConfigDraft(configSnapshot, focusAgentId) : null),
    [configSnapshot, focusAgentId],
  );
  const selectedSkillInstalledInWorkspace = selectedDetail
    ? workspaceSkillIds.has(selectedDetail.skillId)
    : false;
  const selectedGlobalSkillRow = useMemo(
    () =>
      selectedDetail
        ? (globalSkillRows.find((row) => row.skillKey === selectedDetail.skillId) ?? null)
        : null,
    [globalSkillRows, selectedDetail],
  );
  const selectedSharedSkillEntry = useMemo(
    () =>
      selectedDetail
        ? ((globalInventory?.sharedSkills ?? []).find(
            (entry) => entry.skillId === selectedDetail.skillId,
          ) ?? null)
        : null,
    [globalInventory, selectedDetail],
  );
  const selectedInheritedRuntimeSkill = useMemo(
    () =>
      selectedDetail
        ? (inheritedRuntimeSkills.find(
            (entry) => (entry.skillKey || entry.name) === selectedDetail.skillId,
          ) ?? null)
        : null,
    [inheritedRuntimeSkills, selectedDetail],
  );
  const selectedWorkspaceSkillEntry = useMemo(
    () =>
      selectedDetail
        ? ((agentInventory?.workspaceSkills ?? []).find(
            (entry) => entry.skillId === selectedDetail.skillId,
          ) ?? null)
        : null,
    [agentInventory, selectedDetail],
  );
  const selectedAgentSkillEnabled = useMemo(
    () =>
      Boolean(
        focusAgentId &&
          selectedDetail &&
          agentConfigDraft &&
          isSkillEquipped(agentConfigDraft, selectedDetail.skillId),
      ),
    [agentConfigDraft, focusAgentId, selectedDetail],
  );

  async function handleRunDemo(): Promise<void> {
    if (!selectedDetail || !selectedDemo) return;
    setIsRunningDemo(true);
    setLastDemoRun(null);
    try {
      const run = await adapter.runSkillStudioDemo(selectedDetail.skillId, selectedDemo.id);
      if (run) setLastDemoRun(run);
    } finally {
      setIsRunningDemo(false);
    }
  }

  async function handleSaveManifest(): Promise<void> {
    if (!selectedDetail || !manifestEditor) return;
    setIsSaving(true);
    setSaveStatus("");
    try {
      const saved = await adapter.saveSkillStudioManifest(
        selectedDetail.skillId,
        editorMode === "raw" ? { rawYaml: rawManifest } : { manifest: manifestEditor },
      );
      if (!saved) {
        setSaveStatus("skill_manifest_save_failed");
        return;
      }
      setSelectedDetail(saved);
      setManifestDraft(toManifestDraft(saved));
      setRawManifest(stringifySkillManifest(saved.manifest));
      setSaveStatus("Metadata saved.");
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "skill_manifest_save_failed");
    } finally {
      setIsSaving(false);
    }
  }

  function updateManifest(next: Partial<SkillManifest>): void {
    if (!manifestEditor) return;
    setManifestDraft({ ...manifestEditor, ...next });
  }

  async function refreshRuntimeView(): Promise<void> {
    try {
      const [report, snapshot] = await Promise.all([
        focusAgentId ? adapter.getSkillsStatus(focusAgentId) : Promise.resolve(null),
        adapter.getConfigSnapshot().catch(() => null),
      ]);
      setSkillsReport(report);
      setConfigSnapshot(snapshot?.config ?? null);
      if (focusAgentId) {
        setAgentInventory(await adapter.getAgentSkillsInventory(focusAgentId));
      } else {
        setGlobalInventory(await adapter.getGlobalSkillsInventory());
      }
      setRuntimeStatusText("Runtime view refreshed.");
    } catch (error) {
      setRuntimeStatusText(error instanceof Error ? error.message : "skills_refresh_failed");
    }
  }

  async function refreshRuntimeViewWithMessage(message: string): Promise<void> {
    await refreshRuntimeView();
    setRuntimeStatusText(message);
  }

  async function handleToggleGlobalSkill(skillKey: string, enabled: boolean): Promise<void> {
    if (!configSnapshot) return;
    setIsSavingGlobalConfig(true);
    setRuntimeStatusText("");
    try {
      const nextConfig = buildNextGlobalSkillConfig(configSnapshot, skillKey, enabled);
      const result = await adapter.applyConfig(nextConfig, true);
      if (!result.ok) {
        setRuntimeStatusText(result.error ?? "global_skill_config_save_failed");
        return;
      }
      setConfigSnapshot(nextConfig);
      await refreshRuntimeViewWithMessage(`Updated global skill config for ${skillKey}.`);
    } catch (error) {
      setRuntimeStatusText(
        error instanceof Error ? error.message : "global_skill_config_save_failed",
      );
    } finally {
      setIsSavingGlobalConfig(false);
    }
  }

  async function handleToggleAgentSkill(skillId: string): Promise<void> {
    if (!focusAgentId || !configSnapshot) return;
    setIsSavingGlobalConfig(true);
    setRuntimeStatusText("");
    try {
      const currentDraft = resolveAgentConfigDraft(configSnapshot, focusAgentId);
      const nextDraft = toggleSidebarSkill(currentDraft, skillId, knownAgentSkillIds);
      const nextConfig = buildNextAgentConfig(configSnapshot, focusAgentId, nextDraft);
      const result = await adapter.applyConfig(nextConfig, true);
      if (!result.ok) {
        setRuntimeStatusText(result.error ?? "agent_skill_config_save_failed");
        return;
      }
      setConfigSnapshot(nextConfig);
      await refreshRuntimeViewWithMessage(
        isSkillEquipped(nextDraft, skillId)
          ? `Enabled ${skillId} for ${focusAgentId}.`
          : `Disabled ${skillId} for ${focusAgentId}.`,
      );
    } catch (error) {
      setRuntimeStatusText(
        error instanceof Error ? error.message : "agent_skill_config_save_failed",
      );
    } finally {
      setIsSavingGlobalConfig(false);
    }
  }

  async function handleWorkspaceSkillToggle(skillId: string, install: boolean): Promise<void> {
    if (!focusAgentId) return;
    setIsMutatingWorkspace(true);
    setRuntimeStatusText("");
    try {
      const result = install
        ? await adapter.installRepoSkillToAgentWorkspace(focusAgentId, skillId)
        : await adapter.removeAgentWorkspaceSkill(focusAgentId, skillId);
      if (!result.ok) {
        setRuntimeStatusText(result.error ?? "workspace_skill_mutation_failed");
        return;
      }
      setAgentInventory(await adapter.getAgentSkillsInventory(focusAgentId));
      await refreshRuntimeViewWithMessage(
        install
          ? `Installed ${skillId} into agent workspace.`
          : `Removed ${skillId} from agent workspace.`,
      );
    } catch (error) {
      setRuntimeStatusText(
        error instanceof Error ? error.message : "workspace_skill_mutation_failed",
      );
    } finally {
      setIsMutatingWorkspace(false);
    }
  }

  async function handleSaveFile(): Promise<void> {
    if (
      !selectedDetail ||
      !selectedFilePath ||
      !selectedFile?.isText ||
      selectedFile.writable === false
    ) {
      return;
    }
    setIsSavingFile(true);
    setFileSaveStatus("");
    try {
      const saved = await adapter.saveSkillStudioFile(
        selectedDetail.skillId,
        selectedFilePath,
        fileDraft,
      );
      if (!saved) {
        setFileSaveStatus("skill_file_save_failed");
        return;
      }
      setSelectedFile(saved);
      setFileDraft(saved.content ?? "");
      setFileSaveStatus("File saved.");
    } catch (error) {
      setFileSaveStatus(error instanceof Error ? error.message : "skill_file_save_failed");
    } finally {
      setIsSavingFile(false);
    }
  }

  return {
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
    isAgentSkillEquipped: (skillId) =>
      agentConfigDraft ? isSkillEquipped(agentConfigDraft, skillId) : true,
    selection: {
      selectedDetail,
      selectedGlobalSkillRow,
      selectedSharedSkillEntry,
      selectedInheritedRuntimeSkill,
      selectedWorkspaceSkillEntry,
      selectedSkillInstalledInWorkspace,
      selectedAgentSkillEnabled,
      runtimeStatus,
    },
    fileState: {
      selectedFilePath,
      selectedFile,
      fileDraft,
      fileSaveStatus,
      isSavingFile,
    },
    demoState: {
      selectedDemoId,
      lastDemoRun,
      isRunningDemo,
    },
    manifestState: {
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
    },
    agentWorkspacePath: agentInventory?.workspacePath ?? null,
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
  };
}
