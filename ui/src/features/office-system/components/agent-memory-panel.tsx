"use client";

/**
 * AGENT MEMORY PANEL
 * ==================
 * Memory-first operator panel for inspecting an agent's durable notes before
 * jumping into broader workspace or team-board surfaces.
 *
 * KEY CONCEPTS:
 * - Defaults to parsed memory entries grouped by file (`MEMORY.md`, `memory/*.md`).
 * - Raw file preview stays available as supporting context, not the primary view.
 * - Board work routes to the shared Team panel instead of duplicating a local kanban.
 *
 * USAGE:
 * - Render once in office simulation root.
 * - Drive open/close using app-store memoryPanelEmployeeId.
 *
 * MEMORY REFERENCES:
 * - MEM-0109
 * - MEM-0110
 * - MEM-0188
 * - MEM-0191
 */

import { type ReactElement, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/lib/app-store";
import { extractAgentId } from "@/lib/entity-utils";
import { formatTimestamp } from "@/lib/format-utils";
import type { AgentMemoryEntry, AgentsFilesListResult } from "@/lib/openclaw-types";
import { UI_Z } from "@/lib/z-index";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { KanbanTab } from "@/features/team-system/components/kanban-tab";
import {
  extractArtefactPath,
  type PanelTask,
} from "@/features/team-system/components/team-panel-types";
import {
  buildAgentMemoryFileGroups,
  getDefaultAgentMemoryFileName,
  getRawMemoryPreviewText,
  toUserFacingMemoryPanelError,
} from "./agent-memory-panel.helpers";

type MemoryPanelTab = "memory" | "raw" | "kanban";

type FilesState = {
  list: AgentsFilesListResult | null;
  contentByName: Record<string, string>;
  loading: boolean;
  error: string;
};

type MemoryState = {
  entries: AgentMemoryEntry[];
  loading: boolean;
  error: string;
};

const EMPTY_FILES_STATE: FilesState = {
  list: null,
  contentByName: {},
  loading: false,
  error: "",
};

const EMPTY_MEMORY_STATE: MemoryState = {
  entries: [],
  loading: false,
  error: "",
};

function deriveProjectId(teamId: string | null | undefined): string | null {
  if (!teamId) return null;
  const normalized = teamId.trim().toLowerCase();
  return normalized.startsWith("team-") ? normalized.replace(/^team-/, "") : null;
}

function formatEntryType(type?: AgentMemoryEntry["type"]): string {
  if (!type) return "memory";
  return type.replaceAll("_", " ");
}

export function AgentMemoryPanel(): ReactElement | null {
  const adapter = useOpenClawAdapter();
  const { employees, companyModel } = useOfficeDataContext();
  const memoryPanelEmployeeId = useAppStore((state) => state.memoryPanelEmployeeId);
  const setMemoryPanelEmployeeId = useAppStore((state) => state.setMemoryPanelEmployeeId);
  const setActiveTeamId = useAppStore((state) => state.setActiveTeamId);
  const setSelectedTeamId = useAppStore((state) => state.setSelectedTeamId);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const setKanbanFocusAgentId = useAppStore((state) => state.setKanbanFocusAgentId);
  const setIsTeamPanelOpen = useAppStore((state) => state.setIsTeamPanelOpen);

  const [activeTab, setActiveTab] = useState<MemoryPanelTab>("memory");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [filesState, setFilesState] = useState<FilesState>(EMPTY_FILES_STATE);
  const [memoryState, setMemoryState] = useState<MemoryState>(EMPTY_MEMORY_STATE);
  const [reloadTick, setReloadTick] = useState(0);

  const employee = useMemo(
    () => employees.find((row) => row._id === memoryPanelEmployeeId) ?? null,
    [employees, memoryPanelEmployeeId],
  );
  const agentId = useMemo(
    () => extractAgentId(memoryPanelEmployeeId ? String(memoryPanelEmployeeId) : null),
    [memoryPanelEmployeeId],
  );
  const teamId = typeof employee?.teamId === "string" ? employee.teamId : null;
  const projectId = deriveProjectId(teamId);

  const memoryGroups = useMemo(
    () =>
      buildAgentMemoryFileGroups({
        entries: memoryState.entries,
        files: filesState.list?.files ?? [],
      }),
    [filesState.list?.files, memoryState.entries],
  );

  const activeGroup = useMemo(() => {
    if (!selectedFileName) return memoryGroups[0] ?? null;
    return (
      memoryGroups.find((group) => group.fileName === selectedFileName) ?? memoryGroups[0] ?? null
    );
  }, [memoryGroups, selectedFileName]);

  const activeRawContent = activeGroup?.file
    ? (filesState.contentByName[activeGroup.file.name] ?? "")
    : "";
  const teamEmployees = useMemo(
    () => (teamId ? employees.filter((employee) => String(employee.teamId ?? "") === teamId) : []),
    [employees, teamId],
  );
  const ownerLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const employee of teamEmployees) {
      map.set(employee._id, employee.name);
      if (employee._id.startsWith("employee-")) {
        map.set(employee._id.replace(/^employee-/, ""), employee.name);
      }
    }
    return map;
  }, [teamEmployees]);
  const projectTasks = useMemo((): PanelTask[] => {
    if (!companyModel) return [];
    const filtered = companyModel.tasks.filter((task) => {
      if (task.ownerAgentId !== agentId) return false;
      if (!projectId) return true;
      return task.projectId === projectId;
    });
    return filtered.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status as PanelTask["status"],
      ownerAgentId: task.ownerAgentId,
      priority: (task.priority as PanelTask["priority"]) ?? "medium",
      provider: (task.provider as PanelTask["provider"]) ?? "internal",
      providerUrl: task.providerUrl,
      artefactPath: extractArtefactPath(task),
      syncState: (task.syncState as PanelTask["syncState"]) ?? "healthy",
      syncError: task.syncError,
      updatedAt: task.updatedAt,
    }));
  }, [agentId, companyModel, projectId]);

  useEffect(() => {
    if (!memoryPanelEmployeeId) {
      setActiveTab("memory");
      setSelectedFileName(null);
      setFilesState(EMPTY_FILES_STATE);
      setMemoryState(EMPTY_MEMORY_STATE);
      return;
    }
    setActiveTab("memory");
  }, [memoryPanelEmployeeId]);

  useEffect(() => {
    setSelectedFileName(null);
    setFilesState(EMPTY_FILES_STATE);
    setMemoryState(EMPTY_MEMORY_STATE);
  }, [agentId]);

  useEffect(() => {
    if (!selectedFileName && memoryGroups.length > 0) {
      setSelectedFileName(getDefaultAgentMemoryFileName(memoryGroups));
    }
  }, [memoryGroups, selectedFileName]);

  useEffect(() => {
    if (!agentId) {
      setFilesState(EMPTY_FILES_STATE);
      return;
    }
    const resolvedAgentId = agentId;
    let cancelled = false;
    async function loadFiles(): Promise<void> {
      setFilesState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const list = await adapter.listAgentFiles(resolvedAgentId);
        if (cancelled) return;
        setFilesState({
          list,
          contentByName: {},
          loading: false,
          error: "",
        });
      } catch (error) {
        if (cancelled) return;
        setFilesState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : "files_load_failed",
        }));
      }
    }
    void loadFiles();
    return () => {
      cancelled = true;
    };
  }, [adapter, agentId, reloadTick]);

  useEffect(() => {
    if (!agentId) {
      setMemoryState(EMPTY_MEMORY_STATE);
      return;
    }
    const resolvedAgentId = agentId;
    let cancelled = false;
    async function loadMemoryEntries(): Promise<void> {
      setMemoryState({ entries: [], loading: true, error: "" });
      try {
        const entries = await adapter.listAgentMemoryEntries(resolvedAgentId);
        if (cancelled) return;
        setMemoryState({ entries, loading: false, error: "" });
      } catch (error) {
        if (cancelled) return;
        setMemoryState({
          entries: [],
          loading: false,
          error: error instanceof Error ? error.message : "memory_entries_load_failed",
        });
      }
    }
    void loadMemoryEntries();
    return () => {
      cancelled = true;
    };
  }, [adapter, agentId, reloadTick]);

  useEffect(() => {
    if (!agentId || !activeGroup?.file?.name) return;
    const resolvedAgentId = agentId;
    const activeFileName = activeGroup.file.name;
    if (Object.hasOwn(filesState.contentByName, activeFileName)) return;
    let cancelled = false;
    async function loadFileContent(): Promise<void> {
      setFilesState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const result = await adapter.getAgentFile(resolvedAgentId, activeFileName);
        if (cancelled) return;
        setFilesState((current) => ({
          ...current,
          loading: false,
          contentByName: {
            ...current.contentByName,
            [result.file.name]: result.file.content ?? "",
          },
        }));
      } catch (error) {
        if (cancelled) return;
        setFilesState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : "file_load_failed",
        }));
      }
    }
    void loadFileContent();
    return () => {
      cancelled = true;
    };
  }, [activeGroup?.file?.name, adapter, agentId, filesState.contentByName, reloadTick]);

  if (!memoryPanelEmployeeId) return null;

  return (
    <Dialog
      open={Boolean(memoryPanelEmployeeId)}
      onOpenChange={(open) => {
        if (!open) {
          setMemoryPanelEmployeeId(null);
        }
      }}
    >
      <DialogContent
        className="flex min-w-[78vw] max-w-none h-[88vh] flex-col overflow-hidden p-0"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <DialogTitle className="flex items-center gap-2">
                <span>{employee?.name ?? "Agent"} Memory</span>
                {agentId ? <Badge variant="outline">{agentId}</Badge> : null}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{memoryState.entries.length} entries</Badge>
                <Badge variant="secondary">{memoryGroups.length} files</Badge>
                {teamId ? <Badge variant="outline">{teamId}</Badge> : null}
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!agentId || !teamId}
              onClick={() => {
                if (!agentId || !teamId) return;
                setKanbanFocusAgentId(agentId);
                setMemoryPanelEmployeeId(null);
                setActiveTeamId(teamId);
                setSelectedTeamId(teamId);
                setSelectedProjectId(projectId);
                setIsTeamPanelOpen(true);
              }}
            >
              Open Full Board
            </Button>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as MemoryPanelTab)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6"
        >
          <TabsList className="mt-4 w-fit">
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="raw">Raw File</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
          </TabsList>

          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            {memoryState.loading ? (
              <p className="text-muted-foreground">Loading memory entries...</p>
            ) : null}
            {filesState.loading ? (
              <p className="text-muted-foreground">Loading memory files...</p>
            ) : null}
            {memoryState.error ? (
              <p className="text-destructive">
                {toUserFacingMemoryPanelError(memoryState.error, "entries")}
              </p>
            ) : null}
            {filesState.error ? (
              <p className="text-destructive">
                {toUserFacingMemoryPanelError(filesState.error, "files")}
              </p>
            ) : null}
            {memoryState.error || filesState.error ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setReloadTick((current) => current + 1)}
              >
                Retry
              </Button>
            ) : null}
          </div>

          <TabsContent value="memory" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[260px_1fr]">
              <Card className="min-h-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Memory Files</CardTitle>
                </CardHeader>
                <CardContent className="min-h-0">
                  <ScrollArea className="h-[calc(100vh-19rem)] pr-2">
                    <div className="space-y-2">
                      {memoryGroups.map((group) => (
                        <button
                          key={group.key}
                          type="button"
                          className={`w-full rounded-lg border px-3 py-2 text-left transition hover:bg-accent ${
                            activeGroup?.fileName === group.fileName ? "bg-accent" : "bg-background"
                          }`}
                          onClick={() => setSelectedFileName(group.fileName)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{group.fileName}</p>
                            <Badge variant="secondary">{group.entries.length}</Badge>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {group.sourcePath}
                          </p>
                        </button>
                      ))}
                      {!memoryState.loading && memoryGroups.length === 0 ? (
                        <p className="rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground">
                          No memory files found for this agent.
                        </p>
                      ) : null}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="min-h-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {activeGroup ? activeGroup.fileName : "Select a memory file"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="min-h-0">
                  <ScrollArea className="h-[calc(100vh-19rem)] pr-2">
                    <div className="space-y-3">
                      {activeGroup?.entries.map((entry) => (
                        <article key={entry.id} className="rounded-lg border bg-muted/10 p-3">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{formatEntryType(entry.type)}</Badge>
                            {entry.memId ? <Badge variant="secondary">{entry.memId}</Badge> : null}
                            <span>{formatTimestamp(entry.ts)}</span>
                            <span>line {entry.source.lineNumber}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6">{entry.text}</p>
                          {entry.tags.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {entry.tags.map((tag) => (
                                <Badge key={`${entry.id}-${tag}`} variant="outline">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </article>
                      ))}
                      {activeGroup && activeGroup.entries.length === 0 ? (
                        <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                          This file exists, but no parsed memory entries were found yet.
                        </p>
                      ) : null}
                      {!activeGroup && !memoryState.loading ? (
                        <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                          Select a memory file to inspect parsed entries.
                        </p>
                      ) : null}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="raw" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <Card className="h-full min-h-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {activeGroup?.fileName ?? "Select a memory file"}
                </CardTitle>
              </CardHeader>
              <CardContent className="min-h-0">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {activeGroup?.file?.path ?? activeGroup?.sourcePath ?? "No file selected."}
                  </span>
                  {activeGroup?.file?.missing ? <Badge variant="secondary">missing</Badge> : null}
                </div>
                <ScrollArea className="h-[calc(100vh-19rem)] rounded-md border bg-muted/20">
                  <pre className="min-h-full whitespace-pre-wrap break-words p-4 font-mono text-xs leading-5">
                    {getRawMemoryPreviewText({
                      activeGroup,
                      activeRawContent,
                    })}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kanban" className="mt-4 min-h-0 flex-1 overflow-hidden">
            <KanbanTab
              projectTasks={projectTasks}
              focusAgentId={agentId}
              teamEmployees={teamEmployees}
              ownerLabelById={ownerLabelById}
              convexEnabled={false}
              showReadOnlyNotice={false}
              boardActionState={{ pending: false }}
              onBoardCommand={async () => {}}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
