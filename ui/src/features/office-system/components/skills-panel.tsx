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

import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePollWithInterval } from "@/hooks/use-poll-with-interval";
import { useAppStore } from "@/lib/app-store";
import { formatTimestamp as fmtTs } from "@/lib/format-utils";
import type {
  SkillDemoRunResult,
  SkillManifest,
  SkillStatusReport,
  SkillStudioCatalogEntry,
  SkillStudioDetail,
  SkillStudioFileContent,
} from "@/lib/openclaw-types";
import { stringifySkillManifest } from "@/lib/skill-studio";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { UI_Z } from "@/lib/z-index";
import type { AgentSkillsInventory, GlobalSkillsInventory } from "@/lib/openclaw-types";
import {
  buildGlobalSkillRows,
  buildInheritedRuntimeSkillKeys,
  buildNextGlobalSkillConfig,
} from "@/features/office-system/components/skills-panel.runtime";
import {
  buildKnownAgentSkillIds,
  findRuntimeStatusForDetail,
  groupInheritedRuntimeSkills,
} from "@/features/office-system/components/skills-panel-data";
import {
  buildNextAgentConfig,
  resolveAgentConfigDraft,
} from "@/features/office-system/components/manage-agent-modal/config-draft";
import {
  isSkillEquipped,
  toggleSidebarSkill,
} from "@/features/office-system/components/skills-panel.helpers";
import { SkillsPanelSidebar } from "@/features/office-system/components/skills-panel-sidebar";
import { SkillsPanelOverviewTab } from "@/features/office-system/components/skills-panel-overview-tab";
import { SkillsPanelFilesTab } from "@/features/office-system/components/skills-panel-files-tab";
import { SkillsPanelDiagramTab } from "@/features/office-system/components/skills-panel-diagram-tab";
import { SkillsPanelDemosTab } from "@/features/office-system/components/skills-panel-demos-tab";
import { SkillsPanelControlsTab } from "@/features/office-system/components/skills-panel-controls-tab";
import type { DetailTab } from "@/features/office-system/components/skills-panel-types";

function joinLines(lines: string[]): string {
  return lines.join("\n");
}

function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildVisibleGlobalSkillRows(
  rows: ReturnType<typeof buildGlobalSkillRows>,
  sharedSkills: NonNullable<GlobalSkillsInventory["sharedSkills"]>,
  runtimeSearch: string,
): ReturnType<typeof buildGlobalSkillRows> {
  const sharedIds = new Set(sharedSkills.map((entry) => entry.skillId));
  return rows.filter((row) => {
    if (!sharedIds.has(row.skillKey) && row.envCount === 0 && row.configCount === 0) return false;
    if (!runtimeSearch) return true;
    return row.skillKey.toLowerCase().includes(runtimeSearch);
  });
}

function getDemoStepKey(
  caseId: string,
  run: SkillDemoRunResult["steps"][number],
  index: number,
): string {
  return [
    caseId,
    index + 1,
    run.run.join(" "),
    run.stdout,
    run.stderr,
    run.failures.join("|"),
  ].join("::");
}

const SKILL_CARD_DESCRIPTION_CHAR_LIMIT = 84;
const SKILL_STUDIO_SIDEBAR_WIDTH = 380;

function truncateSkillCardDescription(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= SKILL_CARD_DESCRIPTION_CHAR_LIMIT) {
    return normalized;
  }
  return `${normalized.slice(0, SKILL_CARD_DESCRIPTION_CHAR_LIMIT - 1).trimEnd()}...`;
}

function mergeRuntimeStatus(
  skills: SkillStudioCatalogEntry[],
  report: SkillStatusReport | null,
): SkillStudioCatalogEntry[] {
  if (!report) return skills;
  return skills.map((entry) => {
    const runtimeStatus = report.skills.find(
      (row) => row.name === entry.skillId || row.skillKey === entry.skillId,
    );
    return runtimeStatus
      ? {
          ...entry,
          runtimeStatus: {
            eligible: runtimeStatus.eligible,
            blockedByAllowlist: runtimeStatus.blockedByAllowlist,
            disabled: runtimeStatus.disabled,
            source: runtimeStatus.source,
          },
        }
      : entry;
  });
}

function toManifestDraft(detail: SkillStudioDetail): SkillManifest {
  return JSON.parse(JSON.stringify(detail.manifest)) as SkillManifest;
}

function buildMermaidDocument(diagram: string): string {
  const escapedDiagram = JSON.stringify(diagram);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        min-height: 100vh;
        padding: 24px;
        background: #05070b;
        color: #e5e7eb;
        font-family: "JetBrains Mono", ui-monospace, monospace;
      }
      #root {
        min-height: calc(100vh - 48px);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        overflow: auto;
      }
      #root svg {
        max-width: 100%;
        height: auto;
      }
      #root .label {
        color: #e5e7eb !important;
      }
      pre {
        white-space: pre-wrap;
        margin: 0;
        padding: 16px;
        border: 1px solid rgba(148, 163, 184, 0.24);
        background: rgba(15, 23, 42, 0.6);
        border-radius: 12px;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      const source = ${escapedDiagram};
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: "base",
        themeVariables: {
          background: "#05070b",
          primaryColor: "#111827",
          primaryTextColor: "#f3f4f6",
          primaryBorderColor: "#334155",
          lineColor: "#94a3b8",
          secondaryColor: "#111827",
          tertiaryColor: "#0f172a",
          fontFamily: "JetBrains Mono, ui-monospace, monospace",
        },
        flowchart: {
          htmlLabels: true,
          curve: "basis",
        },
      });
      const root = document.getElementById("root");
      mermaid
        .render("skill-studio-diagram", source)
        .then(({ svg }) => {
          if (root) root.innerHTML = svg;
        })
        .catch((error) => {
          if (root) root.innerHTML = "<pre>" + String(error) + "</pre>";
        });
    </script>
  </body>
</html>`;
}

function buildEmptySkillManifest(displayName: string, description: string): SkillManifest {
  return {
    interface: {
      displayName,
      shortDescription: description,
    },
    policy: {
      allowImplicitInvocation: false,
    },
    dependencies: {
      tools: [],
      skills: [],
      docs: [],
    },
    state: {
      mode: "stateless",
    },
    paths: {
      read: [],
      write: [],
    },
    visualization: {},
    references: [],
    demos: {
      labels: {},
    },
  };
}

function buildRuntimeOnlySkillDetail(input: {
  skillId: string;
  catalogEntry?: SkillStudioCatalogEntry | null;
  runtimeStatus?: SkillStatusReport["skills"][number] | null;
  sharedEntry?: NonNullable<GlobalSkillsInventory["sharedSkills"]>[number] | null;
  focusAgentId?: string | null;
}): SkillStudioDetail {
  const displayName =
    input.catalogEntry?.displayName ||
    input.runtimeStatus?.skillKey ||
    input.runtimeStatus?.name ||
    input.skillId;
  const description =
    input.catalogEntry?.description || input.runtimeStatus?.description || "Runtime skill";
  const sourcePath =
    input.runtimeStatus?.filePath || input.sharedEntry?.sourcePath || input.catalogEntry?.sourcePath || "";
  return {
    skillId: input.skillId,
    packageKey: input.catalogEntry?.packageKey || input.skillId,
    displayName,
    description,
    category: input.catalogEntry?.category || "runtime",
    scope: input.focusAgentId ? "agent" : "shared",
    sourcePath,
    updatedAt: input.catalogEntry?.updatedAt,
    manifest: buildEmptySkillManifest(displayName, description),
    manifestPath: "",
    hasManifest: false,
    overviewMarkdown: description,
    mermaid: undefined,
    relatedSkills: [],
    fileEntries: [],
    demoCases: [],
    runtimeStatus: input.runtimeStatus ?? undefined,
    focusAgentId: input.focusAgentId ?? undefined,
  };
}

export function SkillsPanel(): ReactElement {
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
        if (!signal.cancelled)
          setErrorText(error instanceof Error ? error.message : "skills_load_failed");
      }
    },
    10_000,
    [adapter, focusAgentId, isOpen, selectedSkillId, setSelectedSkillId],
  );

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab("overview");
  }, [focusAgentId, isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedSkillId) return;
    let cancelled = false;
    const skillId = selectedSkillId;
    async function loadDetail(): Promise<void> {
      const catalogEntry = skills.find((entry) => entry.skillId === skillId) ?? null;
      const runtimeEntry =
        skillsReport?.skills.find((entry) => entry.name === skillId || entry.skillKey === skillId) ?? null;
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
        const defaultFile = nextDetail.fileEntries[0]?.path ?? null;
        setSelectedFilePath(defaultFile);
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
    const detail = selectedDetail;
    const filePath = selectedFilePath;
    async function loadFile(): Promise<void> {
      const file = await adapter.getSkillStudioFile(detail.skillId, filePath);
      if (!cancelled) {
        setSelectedFile(file);
        setFileDraft(file?.isText ? file.content ?? "" : "");
        setFileSaveStatus("");
      }
    }
    void loadFile();
    return () => {
      cancelled = true;
    };
  }, [adapter, selectedDetail, selectedFilePath]);

  const filteredSkills = useMemo(
    () =>
      skills.filter((entry) => {
        const matchesSearch =
          `${entry.displayName} ${entry.skillId} ${entry.description} ${entry.category}`
            .toLowerCase()
            .includes(search.trim().toLowerCase());
        const matchesFlag =
          flagFilter === "all" ||
          (flagFilter === "has-tests" && entry.hasTests) ||
          (flagFilter === "has-diagram" && entry.hasDiagram) ||
          (flagFilter === "skill-memory" && entry.hasSkillMemory) ||
          (flagFilter === "runtime-blocked" && entry.runtimeStatus?.blockedByAllowlist) ||
          (flagFilter === "runtime-eligible" && entry.runtimeStatus?.eligible);
        return matchesSearch && matchesFlag;
      }),
    [flagFilter, search, skills],
  );
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

  const runtimeStatus = useMemo(() => {
    return selectedDetail?.runtimeStatus ?? findRuntimeStatusForDetail(skillsReport, selectedDetail);
  }, [selectedDetail, skillsReport]);

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
    return keys.map((key) => skillsReport?.skills.find((entry) => (entry.skillKey || entry.name) === key)).filter(
      (entry): entry is NonNullable<typeof entry> => entry !== undefined,
    );
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
    () => buildVisibleGlobalSkillRows(globalSkillRows, globalInventory?.sharedSkills ?? [], runtimeSearch),
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
        ? globalSkillRows.find((row) => row.skillKey === selectedDetail.skillId) ?? null
        : null,
    [globalSkillRows, selectedDetail],
  );
  const selectedSharedSkillEntry = useMemo(
    () =>
      selectedDetail
        ? (globalInventory?.sharedSkills ?? []).find((entry) => entry.skillId === selectedDetail.skillId) ??
          null
        : null,
    [globalInventory, selectedDetail],
  );
  const selectedInheritedRuntimeSkill = useMemo(
    () =>
      selectedDetail
        ? inheritedRuntimeSkills.find(
            (entry) => (entry.skillKey || entry.name) === selectedDetail.skillId,
          ) ?? null
        : null,
    [inheritedRuntimeSkills, selectedDetail],
  );
  const selectedWorkspaceSkillEntry = useMemo(
    () =>
      selectedDetail
        ? (agentInventory?.workspaceSkills ?? []).find((entry) => entry.skillId === selectedDetail.skillId) ??
          null
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
      setRuntimeStatusText(error instanceof Error ? error.message : "agent_skill_config_save_failed");
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
        install ? `Installed ${skillId} into agent workspace.` : `Removed ${skillId} from agent workspace.`,
      );
    } catch (error) {
      setRuntimeStatusText(error instanceof Error ? error.message : "workspace_skill_mutation_failed");
    } finally {
      setIsMutatingWorkspace(false);
    }
  }

  async function handleSaveFile(): Promise<void> {
    if (!selectedDetail || !selectedFilePath || !selectedFile?.isText || selectedFile.writable === false) {
      return;
    }
    setIsSavingFile(true);
    setFileSaveStatus("");
    try {
      const saved = await adapter.saveSkillStudioFile(selectedDetail.skillId, selectedFilePath, fileDraft);
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
              Shared OpenClaw skills on the left. Inspect files, diagrams, demos, and controls in the viewer.
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
              isAgentSkillEquipped={(skillId) =>
                agentConfigDraft ? isSkillEquipped(agentConfigDraft, skillId) : true
              }
              onRefresh={() => void refreshRuntimeView()}
              onSelectSkill={setSelectedSkillId}
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
            {!selectedDetail || !manifestEditor ? (
              <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                Select a runtime skill to inspect its files, diagram, demos, and controls.
              </div>
            ) : (
              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as DetailTab)}
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
                    selection={{
                      selectedDetail,
                      selectedGlobalSkillRow,
                      selectedSharedSkillEntry,
                      selectedInheritedRuntimeSkill,
                      selectedWorkspaceSkillEntry,
                      selectedSkillInstalledInWorkspace,
                      selectedAgentSkillEnabled,
                      runtimeStatus,
                    }}
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
                    agentWorkspacePath={agentInventory?.workspacePath ?? null}
                    selection={{
                      selectedDetail,
                      selectedGlobalSkillRow,
                      selectedSharedSkillEntry,
                      selectedInheritedRuntimeSkill,
                      selectedWorkspaceSkillEntry,
                      selectedSkillInstalledInWorkspace,
                      selectedAgentSkillEnabled,
                      runtimeStatus,
                    }}
                    manifestState={{
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
                    }}
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
                    selection={{
                      selectedDetail,
                      selectedGlobalSkillRow,
                      selectedSharedSkillEntry,
                      selectedInheritedRuntimeSkill,
                      selectedWorkspaceSkillEntry,
                      selectedSkillInstalledInWorkspace,
                      selectedAgentSkillEnabled,
                      runtimeStatus,
                    }}
                    fileState={{
                      selectedFilePath,
                      selectedFile,
                      fileDraft,
                      fileSaveStatus,
                      isSavingFile,
                    }}
                    onSelectFilePath={setSelectedFilePath}
                    onChangeFileDraft={setFileDraft}
                    onSaveFile={() => void handleSaveFile()}
                  />
                </TabsContent>

                <TabsContent value="diagram" className="min-h-0 flex-1 overflow-hidden">
                  <SkillsPanelDiagramTab
                    selection={{
                      selectedDetail,
                      selectedGlobalSkillRow,
                      selectedSharedSkillEntry,
                      selectedInheritedRuntimeSkill,
                      selectedWorkspaceSkillEntry,
                      selectedSkillInstalledInWorkspace,
                      selectedAgentSkillEnabled,
                      runtimeStatus,
                    }}
                    diagramDocument={diagramDocument}
                  />
                </TabsContent>

                <TabsContent value="demos" className="min-h-0 flex-1 overflow-hidden">
                  <SkillsPanelDemosTab
                    selection={{
                      selectedDetail,
                      selectedGlobalSkillRow,
                      selectedSharedSkillEntry,
                      selectedInheritedRuntimeSkill,
                      selectedWorkspaceSkillEntry,
                      selectedSkillInstalledInWorkspace,
                      selectedAgentSkillEnabled,
                      runtimeStatus,
                    }}
                    demoState={{
                      selectedDemoId,
                      lastDemoRun,
                      isRunningDemo,
                    }}
                    selectedDemoTitle={selectedDemoTitle}
                    getDemoStepKey={getDemoStepKey}
                    onSelectDemoId={setSelectedDemoId}
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
