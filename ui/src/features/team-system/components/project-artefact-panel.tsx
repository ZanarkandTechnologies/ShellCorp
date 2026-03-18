"use client";

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
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import {
  buildExplorerTree,
  createFileKey,
  type ExplorerFolderNode,
  findFileByPath,
  inferArtefactFileKind,
} from "./project-artefact-utils";
import { useTeamPanelArtefactState } from "./use-team-panel-artefacts";

/**
 * PROJECT ARTEFACT PANEL
 * ======================
 * Read-only project-scoped artefact browser for generated agent files.
 *
 * KEY CONCEPTS:
 * - Renders a cached Convex index for fast artefact browsing.
 * - Refresh scans project-assigned agent workspaces through the existing OpenClaw gateway.
 * - Supports path/name filtering and on-demand file preview
 * - Keeps workspace files canonical while Convex stores metadata only
 *
 * USAGE:
 * - Render inside Team Panel Artefacts tab
 * - Pass project id/name, scoped agent ids, and optional task path hints
 *
 * MEMORY REFERENCES:
 * - MEM-0136
 * - MEM-0214
 */

type TaskArtefactHint = {
  taskId: string;
  title: string;
  artefactPath?: string;
};

interface ProjectArtefactPanelProps {
  projectId: string;
  projectName: string;
  teamId?: string | null;
  agentIds: string[];
  taskHints: TaskArtefactHint[];
  trackingContext?: string;
  onBack?: () => void;
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

function iconForFile(fileName: string): ReactElement {
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
  teamId,
  agentIds,
  taskHints,
  trackingContext,
  onBack,
}: ProjectArtefactPanelProps): ReactElement {
  const adapter = useOpenClawAdapter();
  const [query, setQuery] = useState("");
  const [activeFileKey, setActiveFileKey] = useState<string | null>(null);
  const [activeFileContent, setActiveFileContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [selectedHintPath, setSelectedHintPath] = useState("");
  const [selectedFolderKey, setSelectedFolderKey] = useState<string | null>(null);
  const [expandedFolderKeys, setExpandedFolderKeys] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);

  const {
    convexEnabled,
    loading,
    files,
    indexedAtMs,
    truncated,
    errorText,
    refreshState,
    refreshArtefacts,
  } = useTeamPanelArtefactState({
    projectId,
    teamId,
    agentIds,
    taskHints,
    trackingContext,
  });

  useEffect(() => {
    if (!files.length) {
      setSelectedFolderKey(null);
      setExpandedFolderKeys(new Set());
      return;
    }
    const roots = buildExplorerTree(files);
    if (roots[0] && !selectedFolderKey) {
      setSelectedFolderKey(roots[0].key);
      setExpandedFolderKeys(new Set(roots.map((root) => root.key)));
    }
  }, [files, selectedFolderKey]);

  useEffect(() => {
    if (convexEnabled && indexedAtMs) return;
    if (convexEnabled) return;
    if (files.length > 0) return;
    void refreshArtefacts();
  }, [convexEnabled, files.length, indexedAtMs, refreshArtefacts]);

  const filteredFiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return files;
    return files.filter(
      (file) =>
        file.path.toLowerCase().includes(needle) || file.name.toLowerCase().includes(needle),
    );
  }, [files, query]);
  const recentFiles = useMemo(() => filteredFiles.slice(0, 12), [filteredFiles]);
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
        const file = activeFile;
        if (!file) return;
        const result = await adapter.getAgentFile(file.agentId, file.name);
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
            {onBack ? (
              <>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back
              </>
            ) : (
              <span className="text-muted-foreground">Artefacts</span>
            )}
          </Button>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{projectName}</span>
            <span>/</span>
            <Badge variant="outline">{projectId}</Badge>
            <Badge variant="secondary">{agentIds.length} agents</Badge>
            {indexedAtMs ? (
              <Badge variant="outline">Indexed {formatFileTimestamp(indexedAtMs)}</Badge>
            ) : null}
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
            variant="outline"
            className="h-8"
            onClick={() => void refreshArtefacts()}
            disabled={refreshState.pending || agentIds.length === 0}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${refreshState.pending ? "animate-spin" : ""}`}
            />
            Refresh Artefacts
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
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Cached in Convex, previewed from live workspace files.</span>
          {truncated ? (
            <Badge variant="outline">Refresh capped to the first 400 artefacts</Badge>
          ) : null}
          {!convexEnabled ? <Badge variant="outline">Convex disabled</Badge> : null}
        </div>
        {refreshState.error ? (
          <p className="mt-2 text-sm text-destructive">{refreshState.error}</p>
        ) : null}
        {refreshState.ok ? (
          <p className="mt-2 text-sm text-emerald-600">{refreshState.ok}</p>
        ) : null}
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
                    <div className="mb-3 border-b border-border/60 pb-3">
                      <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Recent
                      </p>
                      <div className="mt-2 space-y-1">
                        {recentFiles.map((file) => {
                          const key = createFileKey(file);
                          return (
                            <button
                              key={`${key}:${file.path}:recent`}
                              type="button"
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/60"
                              onClick={() => setActiveFileKey(key)}
                            >
                              {iconForFile(file.name)}
                              <span className="min-w-0 flex-1 truncate">{file.name}</span>
                            </button>
                          );
                        })}
                        {recentFiles.length === 0 ? (
                          <p className="px-2 py-2 text-xs text-muted-foreground">
                            No indexed artefacts yet.
                          </p>
                        ) : null}
                      </div>
                    </div>
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
                          onClick={() => {
                            setSelectedFolderKey(folder.key);
                            if (hasChildren) toggleFolder(folder.key);
                          }}
                        >
                          <span className="inline-flex h-4 w-4 items-center justify-center">
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
                      <track kind="captions" label="Captions unavailable" />
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
    </div>
  );
}
