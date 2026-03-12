"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  FileCode2,
  FileImage,
  FileJson,
  FileText,
  FileVideo,
  Folder,
  FolderOpen,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProjectArtefactIndexResult } from "@/lib/openclaw-types";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import {
  buildExplorerTree,
  createFileKey,
  deriveProjectScopeRoots,
  findFileByPath,
  inferArtefactFileKind,
  isHeartbeatArtefact,
  isProjectScopedArtefact,
  type ExplorerFolderNode,
} from "./project-artefact-utils";

/**
 * PROJECT ARTEFACT PANEL
 * ======================
 * Read-only project-scoped artefact browser for generated agent files.
 *
 * KEY CONCEPTS:
 * - Aggregates files from project-assigned agents via OpenClaw gateway methods
 * - Supports path/name filtering and on-demand file preview
 * - Keeps partial failures visible without blocking successful agent file lists
 *
 * USAGE:
 * - Render inside Team Panel Projects tab
 * - Pass project id/name, scoped agent ids, and optional task path hints
 *
 * MEMORY REFERENCES:
 * - MEM-0100
 * - MEM-0109
 * - MEM-0133
 */

type TaskArtefactHint = {
  taskId: string;
  title: string;
  artefactPath?: string;
};

interface ProjectArtefactPanelProps {
  projectId: string;
  projectName: string;
  agentIds: string[];
  taskHints: TaskArtefactHint[];
  trackingContext?: string;
  onBack: () => void;
}

function formatFileTimestamp(ts?: number): string {
  if (!ts) return "Unknown update time";
  return new Date(ts).toLocaleString();
}

function formatFileSize(size?: number): string {
  if (typeof size !== "number" || Number.isNaN(size) || size < 0) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function iconForFile(fileName: string): JSX.Element {
  const kind = inferArtefactFileKind(fileName);
  if (kind === "image") return <FileImage className="h-3.5 w-3.5 text-muted-foreground" />;
  if (kind === "video") return <FileVideo className="h-3.5 w-3.5 text-muted-foreground" />;
  if (kind === "json") return <FileJson className="h-3.5 w-3.5 text-muted-foreground" />;
  if (kind === "code") return <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />;
  return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
}

function flattenTree(nodes: ExplorerFolderNode[]): ExplorerFolderNode[] {
  const rows: ExplorerFolderNode[] = [];
  const walk = (node: ExplorerFolderNode): void => {
    rows.push(node);
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return rows;
}

export function ProjectArtefactPanel({
  projectId,
  projectName,
  agentIds,
  taskHints,
  trackingContext,
  onBack,
}: ProjectArtefactPanelProps): JSX.Element {
  const adapter = useOpenClawAdapter();
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [index, setIndex] = useState<ProjectArtefactIndexResult | null>(null);
  const [query, setQuery] = useState("");
  const [activeFileKey, setActiveFileKey] = useState<string | null>(null);
  const [activeFileContent, setActiveFileContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [selectedHintPath, setSelectedHintPath] = useState("");
  const [hideHeartbeatFiles, setHideHeartbeatFiles] = useState(true);
  const [selectedFolderKey, setSelectedFolderKey] = useState<string | null>(null);
  const [expandedFolderKeys, setExpandedFolderKeys] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setLoading(true);
      setErrorText("");
      setPreviewError("");
      setSelectedHintPath("");
      try {
        const result = await adapter.listProjectArtefacts(projectId, agentIds);
        if (cancelled) return;
        setIndex(result);
        setActiveFileKey(null);
        setPreviewOpen(false);
        const roots = buildExplorerTree(result.files);
        if (roots[0]) {
          setSelectedFolderKey(roots[0].key);
          setExpandedFolderKeys(new Set(roots.map((root) => root.key)));
        } else {
          setSelectedFolderKey(null);
          setExpandedFolderKeys(new Set());
        }
      } catch (error) {
        if (cancelled) return;
        setIndex(null);
        setActiveFileKey(null);
        setSelectedFolderKey(null);
        setErrorText(error instanceof Error ? error.message : "project_artefacts_load_failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [adapter, agentIds, projectId]);

  const taskHintPaths = useMemo(
    () =>
      taskHints
        .map((hint) => hint.artefactPath ?? "")
        .map((path) => path.trim())
        .filter(Boolean),
    [taskHints],
  );
  const scopeRoots = useMemo(
    () => deriveProjectScopeRoots(projectId, taskHintPaths, trackingContext),
    [projectId, taskHintPaths, trackingContext],
  );
  const files = useMemo(() => {
    const raw = index?.files ?? [];
    const projectScoped = raw.filter((file) =>
      isProjectScopedArtefact(file, projectId, scopeRoots),
    );
    return hideHeartbeatFiles
      ? projectScoped.filter((file) => !isHeartbeatArtefact(file))
      : projectScoped;
  }, [hideHeartbeatFiles, index?.files, projectId, scopeRoots]);
  const filteredFiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return files;
    return files.filter(
      (file) =>
        file.path.toLowerCase().includes(needle) || file.name.toLowerCase().includes(needle),
    );
  }, [files, query]);
  const explorerRoots = useMemo(() => buildExplorerTree(filteredFiles), [filteredFiles]);
  const flattenedTree = useMemo(() => flattenTree(explorerRoots), [explorerRoots]);
  const folderByKey = useMemo(() => {
    const map = new Map<string, ExplorerFolderNode>();
    for (const folder of flattenedTree) map.set(folder.key, folder);
    return map;
  }, [flattenedTree]);
  const visibleFolderRows = useMemo(
    () =>
      flattenedTree.filter((folder) => {
        let cursor: ExplorerFolderNode | undefined = folder;
        while (cursor?.parentKey) {
          const parent = folderByKey.get(cursor.parentKey);
          if (!parent) return false;
          if (!expandedFolderKeys.has(parent.key)) return false;
          cursor = parent;
        }
        return true;
      }),
    [expandedFolderKeys, flattenedTree, folderByKey],
  );
  const selectedFolder = selectedFolderKey ? (folderByKey.get(selectedFolderKey) ?? null) : null;
  const selectedFolderFiles = selectedFolder?.files ?? [];

  useEffect(() => {
    if (!selectedFolderKey && explorerRoots[0]) {
      setSelectedFolderKey(explorerRoots[0].key);
      return;
    }
    if (selectedFolderKey && !folderByKey.has(selectedFolderKey)) {
      setSelectedFolderKey(explorerRoots[0]?.key ?? null);
    }
  }, [explorerRoots, folderByKey, selectedFolderKey]);

  const activeFile = useMemo(() => {
    if (!activeFileKey) return null;
    return filteredFiles.find((file) => createFileKey(file) === activeFileKey) ?? null;
  }, [activeFileKey, filteredFiles]);
  const activeFileKind = useMemo(() => {
    if (!activeFile) return "text";
    return inferArtefactFileKind(activeFile.name);
  }, [activeFile]);
  const activeVideoUrl = useMemo(() => {
    if (!activeFile || activeFileKind !== "video") return "";
    return `/openclaw/agents/${encodeURIComponent(activeFile.agentId)}/files/raw?name=${encodeURIComponent(activeFile.name)}`;
  }, [activeFile, activeFileKind]);

  const hintRows = useMemo(
    () =>
      taskHints.filter(
        (entry) => typeof entry.artefactPath === "string" && entry.artefactPath.trim(),
      ),
    [taskHints],
  );

  useEffect(() => {
    if (!activeFile) {
      setActiveFileContent("");
      setPreviewError("");
      setPreviewOpen(false);
      return;
    }
    if (activeFileKind === "video") {
      setActiveFileContent("");
      setPreviewError("");
      setPreviewLoading(false);
      setPreviewOpen(true);
      return;
    }
    let cancelled = false;
    async function loadPreview(): Promise<void> {
      setPreviewLoading(true);
      setPreviewError("");
      try {
        const result = await adapter.getAgentFile(activeFile.agentId, activeFile.name);
        if (cancelled) return;
        setActiveFileContent(result.file.content ?? "");
        setPreviewOpen(true);
      } catch (error) {
        if (cancelled) return;
        setActiveFileContent("");
        setPreviewError(error instanceof Error ? error.message : "project_artefact_preview_failed");
        setPreviewOpen(true);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }
    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [activeFile, activeFileKind, adapter]);

  function handleHintClick(pathHint: string): void {
    setSelectedHintPath(pathHint);
    if (!index) return;
    const matched = findFileByPath(filteredFiles, pathHint);
    if (matched) {
      setQuery("");
      setActiveFileKey(createFileKey(matched));
      const parentFolder = flattenedTree.find((folder) =>
        folder.files.some((file) => createFileKey(file) === createFileKey(matched)),
      );
      if (parentFolder) setSelectedFolderKey(parentFolder.key);
      return;
    }
    setQuery(pathHint);
  }

  function toggleFolder(folderKey: string): void {
    setExpandedFolderKeys((current) => {
      const next = new Set(current);
      if (next.has(folderKey)) next.delete(folderKey);
      else next.add(folderKey);
      return next;
    });
  }

  function closePreview(): void {
    setPreviewOpen(false);
    setActiveFileKey(null);
    setActiveFileContent("");
    setPreviewError("");
  }

  return (
    <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-lg border border-border/60 bg-background">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onBack}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Button>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{projectName}</span>
            <span>/</span>
            <Badge variant="outline">{projectId}</Badge>
            <Badge variant="secondary">{agentIds.length} agents</Badge>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="h-8 pl-8"
              placeholder="Search files..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Button
            size="sm"
            variant={hideHeartbeatFiles ? "secondary" : "outline"}
            className="h-8"
            onClick={() => setHideHeartbeatFiles((current) => !current)}
          >
            {hideHeartbeatFiles ? "Artefacts Only" : "Show All"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setQuery("")}
            disabled={!query}
          >
            Clear
          </Button>
        </div>
        {hintRows.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {hintRows.slice(0, 8).map((hint) => (
              <Button
                key={`${hint.taskId}-${hint.artefactPath}`}
                size="sm"
                variant={selectedHintPath === hint.artefactPath ? "secondary" : "outline"}
                className="h-6 max-w-full justify-start text-[11px]"
                onClick={() => handleHintClick(hint.artefactPath as string)}
              >
                {hint.title}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {loading ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Loading artefacts...</p>
        ) : null}
        {errorText ? <p className="px-4 py-3 text-sm text-destructive">{errorText}</p> : null}

        {!loading && !errorText ? (
          <>
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className="w-64 shrink-0 border-r border-border/60">
                <ScrollArea className="h-full">
                  <div className="p-2">
                    {visibleFolderRows.map((folder) => {
                      const selected = folder.key === selectedFolderKey;
                      const isExpanded = expandedFolderKeys.has(folder.key);
                      const hasChildren = folder.children.length > 0;
                      return (
                        <button
                          key={folder.key}
                          type="button"
                          className={`mb-0.5 flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-xs ${
                            selected
                              ? "bg-muted text-foreground"
                              : "text-muted-foreground hover:bg-muted/60"
                          }`}
                          style={{ paddingLeft: `${6 + folder.depth * 12}px` }}
                          onClick={() => setSelectedFolderKey(folder.key)}
                        >
                          <span
                            className="inline-flex h-4 w-4 items-center justify-center"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (hasChildren) toggleFolder(folder.key);
                            }}
                          >
                            {hasChildren ? (
                              <ChevronRight
                                className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                              />
                            ) : (
                              <span className="h-3.5 w-3.5" />
                            )}
                          </span>
                          {isExpanded ? (
                            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className="truncate">{folder.name}</span>
                        </button>
                      );
                    })}
                    {visibleFolderRows.length === 0 ? (
                      <p className="px-2 py-6 text-xs text-muted-foreground">
                        No project folders found. Save artefacts under a scoped path like `projects/
                        {projectId}/...`.
                      </p>
                    ) : null}
                  </div>
                </ScrollArea>
              </div>

              <div className="min-w-0 flex-1">
                <div className="grid grid-cols-[minmax(0,1fr)_88px_160px] border-b border-border/60 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span>Name</span>
                  <span>Size</span>
                  <span>Modified</span>
                </div>
                <ScrollArea className="h-[calc(100%-33px)]">
                  <div className="divide-y divide-border/50">
                    {selectedFolderFiles.map((file) => {
                      const key = createFileKey(file);
                      const isActive = activeFileKey === key && previewOpen;
                      return (
                        <button
                          key={`${key}:${file.path}`}
                          type="button"
                          className={`grid w-full grid-cols-[minmax(0,1fr)_88px_160px] items-center gap-2 px-3 py-2 text-left text-xs ${
                            isActive ? "bg-muted" : "hover:bg-muted/50"
                          }`}
                          onClick={() => setActiveFileKey(key)}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {iconForFile(file.name)}
                            <span className="truncate">{file.name}</span>
                          </span>
                          <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
                          <span className="truncate text-muted-foreground">
                            {formatFileTimestamp(file.updatedAtMs)}
                          </span>
                        </button>
                      );
                    })}
                    {selectedFolderFiles.length === 0 ? (
                      <p className="px-3 py-8 text-sm text-muted-foreground">
                        No files in this folder.
                      </p>
                    ) : null}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {previewOpen && activeFile ? (
              <div className="h-52 border-t border-border/60">
                <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-xs">
                  <div className="min-w-0 truncate text-muted-foreground">
                    <span className="font-medium text-foreground">{activeFile.name}</span>
                    <span className="mx-1">·</span>
                    <span>{formatFileSize(activeFile.size)}</span>
                    <span className="mx-1">·</span>
                    <span>{formatFileTimestamp(activeFile.updatedAtMs)}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={closePreview}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Close
                  </Button>
                </div>
                <ScrollArea className="h-[calc(100%-33px)] px-3 py-2">
                  {previewLoading ? (
                    <p className="text-sm text-muted-foreground">Loading file preview...</p>
                  ) : null}
                  {!previewLoading && previewError ? (
                    <p className="text-sm text-destructive">{previewError}</p>
                  ) : null}
                  {!previewLoading && !previewError && activeFileKind === "video" ? (
                    <video
                      className="max-h-44 w-full rounded border border-border/50 bg-black"
                      controls
                      preload="metadata"
                      src={activeVideoUrl}
                    >
                      Your browser does not support video playback.
                    </video>
                  ) : null}
                  {!previewLoading && !previewError && activeFileKind !== "video" ? (
                    <pre className="whitespace-pre-wrap break-words text-xs">
                      {activeFileContent || "(empty file)"}
                    </pre>
                  ) : null}
                </ScrollArea>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {index?.groups.some((group) => group.error) ? (
        <div className="border-t border-amber-400/50 bg-amber-400/10 px-3 py-2 text-xs">
          <p className="font-medium">Partial fetch issues</p>
          {index.groups
            .filter((group) => group.error)
            .map((group) => (
              <p key={`${group.agentId}:${group.error}`}>
                {group.agentId}: {group.error}
              </p>
            ))}
        </div>
      ) : null}
    </div>
  );
}
