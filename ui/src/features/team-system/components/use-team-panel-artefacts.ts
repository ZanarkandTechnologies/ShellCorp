"use client";

/**
 * TEAM PANEL ARTEFACT STATE
 * =========================
 * Purpose
 * - Encapsulate cached Convex artefact index queries and explicit refresh behavior.
 *
 * KEY CONCEPTS:
 * - Convex stores a refreshable metadata cache for project artefacts.
 * - OpenClaw workspace files remain canonical and are scanned only on explicit refresh.
 * - The panel falls back to direct scans when Convex is unavailable.
 *
 * USAGE:
 * - Call from ProjectArtefactPanel with project scope, agent ids, and task path hints.
 *
 * MEMORY REFERENCES:
 * - MEM-0136
 * - MEM-0214
 */

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectArtefactEntry } from "@/lib/openclaw-types";
import { isConvexEnabled } from "@/providers/convex-provider";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { api } from "../../../../../convex/_generated/api";
import {
  deriveProjectScopeRoots,
  inferArtefactFileKind,
  selectProjectArtefactsForIndex,
} from "./project-artefact-utils";

interface TaskArtefactHint {
  taskId: string;
  title: string;
  artefactPath?: string;
}

interface IndexedArtefactFile extends ProjectArtefactEntry {
  kind: string;
  indexedAtMs?: number;
  lastSeenAtMs?: number;
  status: "present" | "missing";
  isPreviewable: boolean;
  taskId?: string;
  truncated?: boolean;
}

interface RefreshState {
  pending: boolean;
  error?: string;
  ok?: string;
}

function isPreviewableKind(kind: string): boolean {
  return kind === "markdown" || kind === "text" || kind === "json" || kind === "code";
}

function matchTaskIdForPath(taskHints: TaskArtefactHint[], path: string): string | undefined {
  const normalized = path.trim();
  if (!normalized) return undefined;
  return taskHints.find((hint) => {
    const hintPath = hint.artefactPath?.trim();
    return Boolean(hintPath && (normalized === hintPath || normalized.endsWith(hintPath)));
  })?.taskId;
}

export function useTeamPanelArtefactState(input: {
  projectId: string;
  teamId?: string | null;
  agentIds: string[];
  taskHints: TaskArtefactHint[];
  trackingContext?: string;
}): {
  convexEnabled: boolean;
  loading: boolean;
  files: IndexedArtefactFile[];
  indexedAtMs?: number;
  truncated: boolean;
  errorText: string;
  refreshState: RefreshState;
  refreshArtefacts: () => Promise<void>;
} {
  const { projectId, teamId, agentIds, taskHints, trackingContext } = input;
  const convexEnabled = isConvexEnabled();
  const adapter = useOpenClawAdapter();
  const [fallbackFiles, setFallbackFiles] = useState<IndexedArtefactFile[]>([]);
  const [fallbackIndexedAtMs, setFallbackIndexedAtMs] = useState<number>();
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [refreshState, setRefreshState] = useState<RefreshState>({ pending: false });

  const syncArtefacts = useMutation(api.team_artefacts.syncProjectArtefactIndex);
  const convexArtefacts = useQuery(
    api.team_artefacts.listProjectArtefactIndex,
    convexEnabled ? { projectId, limit: 600 } : "skip",
  );

  const scopeRoots = useMemo(() => {
    const taskHintPaths = taskHints.map((hint) => hint.artefactPath?.trim() ?? "").filter(Boolean);
    return deriveProjectScopeRoots(projectId, taskHintPaths, trackingContext);
  }, [projectId, taskHints, trackingContext]);

  const refreshArtefacts = useCallback(async (): Promise<void> => {
    const dedupedAgentIds = [...new Set(agentIds.map((entry) => entry.trim()).filter(Boolean))];
    if (!projectId.trim() || dedupedAgentIds.length === 0) return;
    setRefreshState({ pending: true });
    setErrorText("");

    try {
      const index = await adapter.listProjectArtefacts(projectId, dedupedAgentIds);
      const selected = selectProjectArtefactsForIndex(index.files, projectId, scopeRoots);
      const indexedAtMs = Date.now();
      const files = selected.files.map((file) => {
        const kind = inferArtefactFileKind(file.name);
        return {
          ...file,
          kind,
          indexedAtMs,
          lastSeenAtMs: indexedAtMs,
          status: "present" as const,
          isPreviewable: isPreviewableKind(kind),
          taskId: matchTaskIdForPath(taskHints, file.path),
          truncated: selected.truncated,
        };
      });

      if (convexEnabled) {
        await syncArtefacts({
          teamId: teamId ?? undefined,
          projectId,
          indexedAtMs,
          truncated: selected.truncated,
          files: files.map((file) => ({
            agentId: file.agentId,
            workspace: file.workspace,
            path: file.path,
            name: file.name,
            kind: file.kind,
            sizeBytes: file.size,
            updatedAtMs: file.updatedAtMs,
            isPreviewable: file.isPreviewable,
            taskId: file.taskId,
          })),
        });
      } else {
        setFallbackFiles(files);
        setFallbackIndexedAtMs(indexedAtMs);
      }

      setRefreshState({
        pending: false,
        ok: selected.truncated
          ? `Indexed ${files.length} artefacts. Showing the first ${files.length}.`
          : `Indexed ${files.length} artefacts.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "project_artefacts_refresh_failed";
      setErrorText(message);
      setRefreshState({ pending: false, error: message });
    }
  }, [adapter, agentIds, convexEnabled, projectId, scopeRoots, syncArtefacts, taskHints, teamId]);

  useEffect(() => {
    if (convexEnabled || !projectId.trim() || agentIds.length === 0) return;
    let cancelled = false;
    async function loadFallback(): Promise<void> {
      setFallbackLoading(true);
      setErrorText("");
      try {
        await refreshArtefacts();
      } finally {
        if (!cancelled) setFallbackLoading(false);
      }
    }
    void loadFallback();
    return () => {
      cancelled = true;
    };
  }, [agentIds, convexEnabled, projectId, refreshArtefacts]);

  const files = useMemo(() => {
    if (!convexEnabled) return fallbackFiles;
    return (convexArtefacts?.files ?? []).map((file) => ({
      projectId: file.projectId,
      agentId: file.agentId,
      workspace: file.workspace,
      name: file.name,
      path: file.path,
      missing: file.status === "missing",
      size: file.sizeBytes,
      updatedAtMs: file.updatedAtMs,
      kind: file.kind,
      indexedAtMs: file.indexedAtMs,
      lastSeenAtMs: file.lastSeenAtMs,
      status: file.status,
      isPreviewable: file.isPreviewable,
      taskId: file.taskId,
      truncated: file.truncated,
    }));
  }, [convexArtefacts?.files, convexEnabled, fallbackFiles]);

  return {
    convexEnabled,
    loading: convexEnabled ? convexArtefacts === undefined : fallbackLoading,
    files,
    indexedAtMs: convexEnabled ? convexArtefacts?.indexedAtMs : fallbackIndexedAtMs,
    truncated: convexEnabled
      ? convexArtefacts?.truncated === true
      : files.some((file) => file.truncated),
    errorText,
    refreshState,
    refreshArtefacts,
  };
}
