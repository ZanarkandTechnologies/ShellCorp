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
 */

import { useEffect, useMemo, useState } from "react";
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
  SkillDemoCase,
  SkillDemoRunResult,
  SkillManifest,
  SkillStatusEntry,
  SkillStatusReport,
  SkillStudioCatalogEntry,
  SkillStudioDetail,
  SkillStudioFileContent,
} from "@/lib/openclaw-types";
import { stringifySkillManifest } from "@/lib/skill-studio";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { UI_Z } from "@/lib/z-index";

function joinLines(lines: string[]): string {
  return lines.join("\n");
}

function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
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
const SKILL_STUDIO_SIDEBAR_WIDTH = 420;

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

export function SkillsPanel(): JSX.Element {
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
  const [selectedDemoId, setSelectedDemoId] = useState<string | null>(null);
  const [lastDemoRun, setLastDemoRun] = useState<SkillDemoRunResult | null>(null);
  const [skillsReport, setSkillsReport] = useState<SkillStatusReport | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [flagFilter, setFlagFilter] = useState("all");
  const [errorText, setErrorText] = useState("");
  const [manifestDraft, setManifestDraft] = useState<SkillManifest | null>(null);
  const [rawManifest, setRawManifest] = useState("");
  const [editorMode, setEditorMode] = useState<"structured" | "raw">("structured");
  const [saveStatus, setSaveStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRunningDemo, setIsRunningDemo] = useState(false);
  const selectOverlayStyle = useMemo(() => ({ zIndex: UI_Z.panelModal + 1 }), []);

  usePollWithInterval(
    async (signal) => {
      if (!isOpen) return;
      try {
        const [catalog, report] = await Promise.all([
          adapter.listSkillStudioCatalog(),
          focusAgentId ? adapter.getSkillsStatus(focusAgentId) : Promise.resolve(null),
        ]);
        if (signal.cancelled) return;
        setSkills(mergeRuntimeStatus(catalog, report));
        setSkillsReport(report);
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
    if (!isOpen || !selectedSkillId) return;
    let cancelled = false;
    async function loadDetail(): Promise<void> {
      try {
        const detail = await adapter.getSkillStudioDetail(
          selectedSkillId,
          focusAgentId ?? undefined,
        );
        if (cancelled || !detail) return;
        const runtimeStatus =
          skillsReport?.skills.find(
            (entry) => entry.name === detail.skillId || entry.skillKey === detail.skillId,
          ) ?? undefined;
        const nextDetail = runtimeStatus ? { ...detail, runtimeStatus } : detail;
        setSelectedDetail(nextDetail);
        setManifestDraft(toManifestDraft(nextDetail));
        const configFile = await adapter
          .getSkillStudioFile(selectedSkillId, "skill.config.yaml")
          .catch(() => null);
        setRawManifest(configFile?.content ?? stringifySkillManifest(nextDetail.manifest));
        const defaultFile = nextDetail.fileEntries[0]?.path ?? null;
        setSelectedFilePath(defaultFile);
        setSelectedDemoId(nextDetail.demoCases[0]?.id ?? null);
        setLastDemoRun(null);
        setSaveStatus("");
      } catch (error) {
        if (!cancelled)
          setErrorText(error instanceof Error ? error.message : "skill_detail_failed");
      }
    }
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [adapter, focusAgentId, isOpen, selectedSkillId, skillsReport]);

  useEffect(() => {
    if (!selectedDetail || !selectedFilePath) {
      setSelectedFile(null);
      return;
    }
    let cancelled = false;
    async function loadFile(): Promise<void> {
      const file = await adapter.getSkillStudioFile(selectedDetail.skillId, selectedFilePath);
      if (!cancelled) setSelectedFile(file);
    }
    void loadFile();
    return () => {
      cancelled = true;
    };
  }, [adapter, selectedDetail, selectedFilePath]);

  const categories = useMemo(
    () => ["all", ...new Set(skills.map((entry) => entry.category).filter(Boolean))],
    [skills],
  );

  const filteredSkills = useMemo(
    () =>
      skills.filter((entry) => {
        const matchesSearch =
          `${entry.displayName} ${entry.skillId} ${entry.description} ${entry.category}`
            .toLowerCase()
            .includes(search.trim().toLowerCase());
        const matchesCategory = categoryFilter === "all" || entry.category === categoryFilter;
        const matchesFlag =
          flagFilter === "all" ||
          (flagFilter === "has-tests" && entry.hasTests) ||
          (flagFilter === "has-diagram" && entry.hasDiagram) ||
          (flagFilter === "skill-memory" && entry.hasSkillMemory) ||
          (flagFilter === "runtime-blocked" && entry.runtimeStatus?.blockedByAllowlist) ||
          (flagFilter === "runtime-eligible" && entry.runtimeStatus?.eligible);
        return matchesSearch && matchesCategory && matchesFlag;
      }),
    [categoryFilter, flagFilter, search, skills],
  );

  const selectedDemo = useMemo(
    () => selectedDetail?.demoCases.find((entry) => entry.id === selectedDemoId) ?? null,
    [selectedDemoId, selectedDetail],
  );

  const runtimeStatus =
    selectedDetail?.runtimeStatus ??
    skillsReport?.skills.find(
      (entry) =>
        entry.name === selectedDetail?.skillId || entry.skillKey === selectedDetail?.skillId,
    ) ??
    null;

  const manifestEditor = manifestDraft;
  const readPathsText = manifestEditor ? joinLines(manifestEditor.paths.read) : "";
  const writePathsText = manifestEditor ? joinLines(manifestEditor.paths.write) : "";
  const dependencySkillsText = manifestEditor ? joinLines(manifestEditor.dependencies.skills) : "";
  const dependencyDocsText = manifestEditor ? joinLines(manifestEditor.dependencies.docs) : "";
  const referencesText = manifestEditor ? joinLines(manifestEditor.references) : "";
  const canSave = Boolean(selectedDetail && manifestEditor && !isSaving);

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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="min-w-[88vw] max-w-none h-[92vh] overflow-hidden p-0"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Skill Studio</DialogTitle>
          {focusAgentId ? (
            <p className="text-xs text-muted-foreground">Focused agent: {focusAgentId}</p>
          ) : null}
          {errorText ? <p className="text-xs text-destructive">{errorText}</p> : null}
        </DialogHeader>
        <div
          className="grid h-full overflow-hidden"
          style={{ gridTemplateColumns: `${SKILL_STUDIO_SIDEBAR_WIDTH}px minmax(0, 1fr)` }}
        >
          <div className="border-r p-4">
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search skills"
              />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent style={selectOverlayStyle}>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={flagFilter} onValueChange={setFlagFilter}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent style={selectOverlayStyle}>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="has-tests">Has tests</SelectItem>
                <SelectItem value="has-diagram">Has diagram</SelectItem>
                <SelectItem value="skill-memory">Skill memory</SelectItem>
                <SelectItem value="runtime-eligible">Runtime eligible</SelectItem>
                <SelectItem value="runtime-blocked">Runtime blocked</SelectItem>
              </SelectContent>
            </Select>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs">Skills</CardTitle>
                </CardHeader>
                <CardContent>{skills.length}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs">Tests</CardTitle>
                </CardHeader>
                <CardContent>{skills.filter((entry) => entry.hasTests).length}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs">Diagrams</CardTitle>
                </CardHeader>
                <CardContent>{skills.filter((entry) => entry.hasDiagram).length}</CardContent>
              </Card>
            </div>

            <ScrollArea className="mt-4 h-[calc(100vh-22rem)] rounded-md border">
              <div className="space-y-2 p-2">
                {filteredSkills.map((skill) => (
                  <button
                    type="button"
                    key={skill.packageKey}
                    onClick={() => setSelectedSkillId(skill.skillId)}
                    className={`w-full min-w-0 rounded-md border p-3 text-left transition ${selectedSkillId === skill.skillId ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                    style={{ maxWidth: `calc(${SKILL_STUDIO_SIDEBAR_WIDTH}px - 2rem)` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate font-medium">{skill.displayName}</p>
                      <Badge variant="secondary">{skill.category}</Badge>
                    </div>
                    <p className="mt-1 min-h-[2.75rem] max-w-full break-words text-xs leading-relaxed text-muted-foreground">
                      {truncateSkillCardDescription(skill.description || skill.skillId)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {skill.hasTests ? <Badge variant="outline">tests</Badge> : null}
                      {skill.hasDiagram ? <Badge variant="outline">diagram</Badge> : null}
                      {skill.hasSkillMemory ? <Badge variant="outline">skill memory</Badge> : null}
                      {skill.runtimeStatus?.blockedByAllowlist ? (
                        <Badge variant="destructive">blocked</Badge>
                      ) : null}
                      {skill.runtimeStatus?.eligible ? (
                        <Badge variant="secondary">eligible</Badge>
                      ) : null}
                    </div>
                  </button>
                ))}
                {filteredSkills.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">
                    No skills match the current filters.
                  </p>
                ) : null}
              </div>
            </ScrollArea>
          </div>

          <div className="min-h-0 overflow-hidden p-4">
            {!selectedDetail || !manifestEditor ? (
              <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                Select a skill to inspect its files, diagram, and demos.
              </div>
            ) : (
              <Tabs defaultValue="overview" className="flex h-full min-h-0 flex-col">
                <TabsList className="shrink-0">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="files">Files</TabsTrigger>
                  <TabsTrigger value="diagram">Diagram</TabsTrigger>
                  <TabsTrigger value="demos">Demos</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="min-h-0 flex-1 overflow-hidden">
                  <ScrollArea className="h-full min-h-0 rounded-md border p-4">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold">{selectedDetail.displayName}</h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedDetail.description || selectedDetail.skillId}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {selectedDetail.sourcePath}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{selectedDetail.category}</Badge>
                          {selectedDetail.hasManifest ? (
                            <Badge variant="outline">manifest</Badge>
                          ) : null}
                          {selectedDetail.manifest.state.mode === "skill_memory" ? (
                            <Badge variant="outline">skill memory</Badge>
                          ) : null}
                          {runtimeStatus?.eligible ? (
                            <Badge variant="secondary">eligible</Badge>
                          ) : null}
                          {runtimeStatus?.blockedByAllowlist ? (
                            <Badge variant="destructive">blocked by allowlist</Badge>
                          ) : null}
                        </div>
                      </div>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Runtime Readiness</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <p>
                            Updated:{" "}
                            {selectedDetail.updatedAt ? fmtTs(selectedDetail.updatedAt) : "n/a"}
                          </p>
                          <p>
                            Scope: {focusAgentId ? `agent-aware (${focusAgentId})` : "repo package"}
                          </p>
                          <p>
                            Allowlist state:{" "}
                            {runtimeStatus?.blockedByAllowlist
                              ? "blocked"
                              : runtimeStatus
                                ? "allowed"
                                : "n/a"}
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
                          <div className="flex items-center gap-2">
                            <Button
                              variant={editorMode === "structured" ? "default" : "outline"}
                              size="sm"
                              onClick={() => setEditorMode("structured")}
                            >
                              Structured
                            </Button>
                            <Button
                              variant={editorMode === "raw" ? "default" : "outline"}
                              size="sm"
                              onClick={() => setEditorMode("raw")}
                            >
                              Raw YAML
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => void handleSaveManifest()}
                              disabled={!canSave}
                            >
                              {isSaving ? "Saving..." : "Save metadata"}
                            </Button>
                            {saveStatus ? (
                              <span className="text-xs text-muted-foreground">{saveStatus}</span>
                            ) : null}
                          </div>

                          {editorMode === "structured" ? (
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Display Name</Label>
                                <Input
                                  value={manifestEditor.interface.displayName}
                                  onChange={(event) =>
                                    updateManifest({
                                      interface: {
                                        ...manifestEditor.interface,
                                        displayName: event.target.value,
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Brand Color</Label>
                                <Input
                                  value={manifestEditor.interface.brandColor ?? ""}
                                  onChange={(event) =>
                                    updateManifest({
                                      interface: {
                                        ...manifestEditor.interface,
                                        brandColor: event.target.value || undefined,
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label>Short Description</Label>
                                <Textarea
                                  value={manifestEditor.interface.shortDescription}
                                  onChange={(event) =>
                                    updateManifest({
                                      interface: {
                                        ...manifestEditor.interface,
                                        shortDescription: event.target.value,
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label>Default Prompt</Label>
                                <Textarea
                                  value={manifestEditor.interface.defaultPrompt ?? ""}
                                  onChange={(event) =>
                                    updateManifest({
                                      interface: {
                                        ...manifestEditor.interface,
                                        defaultPrompt: event.target.value || undefined,
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>State Mode</Label>
                                <Select
                                  value={manifestEditor.state.mode}
                                  onValueChange={(value) =>
                                    updateManifest({
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
                              <div className="space-y-2">
                                <Label>Memory File</Label>
                                <Input
                                  value={manifestEditor.state.memoryFile ?? ""}
                                  onChange={(event) =>
                                    updateManifest({
                                      state: {
                                        ...manifestEditor.state,
                                        memoryFile: event.target.value || undefined,
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Read Paths</Label>
                                <Textarea
                                  value={readPathsText}
                                  onChange={(event) =>
                                    updateManifest({
                                      paths: {
                                        ...manifestEditor.paths,
                                        read: splitLines(event.target.value),
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Write Paths</Label>
                                <Textarea
                                  value={writePathsText}
                                  onChange={(event) =>
                                    updateManifest({
                                      paths: {
                                        ...manifestEditor.paths,
                                        write: splitLines(event.target.value),
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Related Skills</Label>
                                <Textarea
                                  value={dependencySkillsText}
                                  onChange={(event) =>
                                    updateManifest({
                                      dependencies: {
                                        ...manifestEditor.dependencies,
                                        skills: splitLines(event.target.value),
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Docs</Label>
                                <Textarea
                                  value={dependencyDocsText}
                                  onChange={(event) =>
                                    updateManifest({
                                      dependencies: {
                                        ...manifestEditor.dependencies,
                                        docs: splitLines(event.target.value),
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label>References</Label>
                                <Textarea
                                  value={referencesText}
                                  onChange={(event) =>
                                    updateManifest({ references: splitLines(event.target.value) })
                                  }
                                />
                              </div>
                            </div>
                          ) : (
                            <Textarea
                              className="min-h-[28rem] font-mono text-xs"
                              value={rawManifest}
                              onChange={(event) => setRawManifest(event.target.value)}
                            />
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="files" className="min-h-0 flex-1 overflow-hidden">
                  <div className="grid h-full min-h-0 grid-cols-[260px_minmax(0,1fr)] gap-4">
                    <ScrollArea className="h-full min-h-0 rounded-md border">
                      <div className="space-y-1 p-2">
                        {selectedDetail.fileEntries.map((file) => (
                          <button
                            key={file.path}
                            type="button"
                            onClick={() => setSelectedFilePath(file.path)}
                            className={`w-full rounded-md px-3 py-2 text-left text-sm ${selectedFilePath === file.path ? "bg-primary/10 text-primary" : "hover:bg-muted/40"}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span>{file.path}</span>
                              <Badge variant="outline">{file.kind}</Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                    <ScrollArea className="h-full min-h-0 rounded-md border">
                      <div className="min-h-full p-4">
                        {!selectedFile ? (
                          <p className="text-sm text-muted-foreground">
                            Select a file to preview it.
                          </p>
                        ) : !selectedFile.isText ? (
                          <p className="text-sm text-muted-foreground">
                            Binary or non-text asset. Size: {selectedFile.sizeBytes ?? 0} bytes.
                          </p>
                        ) : (
                          <pre className="whitespace-pre-wrap break-words text-xs leading-6">
                            {selectedFile.content}
                          </pre>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>

                <TabsContent value="diagram" className="min-h-0 flex-1 overflow-hidden">
                  <ScrollArea className="h-full min-h-0 rounded-md border p-4">
                    {selectedDetail.mermaid ? (
                      <div className="space-y-4">
                        <iframe
                          title={`${selectedDetail.displayName} diagram`}
                          srcDoc={buildMermaidDocument(selectedDetail.mermaid)}
                          className="h-[28rem] w-full rounded-md border bg-background"
                        />
                        <Textarea
                          readOnly
                          className="min-h-[20rem] font-mono text-xs"
                          value={selectedDetail.mermaid}
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No Mermaid diagram found in this skill package yet.
                      </p>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="demos" className="min-h-0 flex-1 overflow-hidden">
                  <div className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)] gap-4">
                    <ScrollArea className="h-full min-h-0 rounded-md border">
                      <div className="space-y-2 p-2">
                        {selectedDetail.demoCases.map((demo) => (
                          <button
                            key={demo.id}
                            type="button"
                            onClick={() => setSelectedDemoId(demo.id)}
                            className={`w-full rounded-md border p-3 text-left ${selectedDemoId === demo.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                          >
                            <p className="font-medium">{demo.title}</p>
                            <p className="text-xs text-muted-foreground">{demo.relativePath}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {demo.stepCount} step(s)
                            </p>
                          </button>
                        ))}
                        {selectedDetail.demoCases.length === 0 ? (
                          <p className="p-2 text-sm text-muted-foreground">
                            No demo cases found under `tests/*.md`.
                          </p>
                        ) : null}
                      </div>
                    </ScrollArea>
                    <ScrollArea className="h-full min-h-0 rounded-md border">
                      <div className="min-h-full space-y-4 p-4">
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => void handleRunDemo()}
                            disabled={!selectedDemo || isRunningDemo}
                          >
                            {isRunningDemo ? "Running..." : "Run saved case"}
                          </Button>
                          {selectedDemo ? (
                            <p className="text-sm text-muted-foreground">{selectedDemo.title}</p>
                          ) : null}
                        </div>
                        {!lastDemoRun ? (
                          <p className="text-sm text-muted-foreground">
                            Run a saved markdown demo case to inspect stdout, assertions, and
                            step-by-step results.
                          </p>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={lastDemoRun.passed ? "secondary" : "destructive"}>
                                {lastDemoRun.passed ? "passed" : "failed"}
                              </Badge>
                              <Badge variant="outline">{lastDemoRun.durationMs} ms</Badge>
                            </div>
                            {lastDemoRun.steps.map((step, index) => (
                              <Card key={getDemoStepKey(lastDemoRun.caseId, step, index)}>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm">Step {index + 1}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-xs">
                                  <pre className="whitespace-pre-wrap break-words rounded bg-muted/40 p-2">
                                    {step.run.join(" ")}
                                  </pre>
                                  {step.stdout ? (
                                    <pre className="whitespace-pre-wrap break-words rounded bg-muted/30 p-2">
                                      {step.stdout}
                                    </pre>
                                  ) : null}
                                  {step.stderr ? (
                                    <pre className="whitespace-pre-wrap break-words rounded bg-destructive/10 p-2">
                                      {step.stderr}
                                    </pre>
                                  ) : null}
                                  {step.failures.length > 0 ? (
                                    <pre className="whitespace-pre-wrap break-words rounded bg-destructive/10 p-2">
                                      {step.failures.join("\n")}
                                    </pre>
                                  ) : null}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
