/**
 * AGENT MEMORY PANEL HELPERS
 * ==========================
 * Pure helpers for deriving the memory-first panel view model from OpenClaw
 * memory entries and agent workspace files.
 *
 * KEY CONCEPTS:
 * - Parsed memory entries remain the primary source of truth for the panel.
 * - Source files are normalized to workspace file names when possible.
 * - `MEMORY.md` sorts first, followed by `memory/*.md`, then other sources.
 *
 * USAGE:
 * - Used by `agent-memory-panel.tsx` to build sidebar groups and defaults.
 *
 * MEMORY REFERENCES:
 * - MEM-0110
 * - MEM-0191
 */

import type { AgentFileEntry, AgentMemoryEntry } from "@/lib/openclaw-types";

export type AgentMemoryFileGroup = {
  key: string;
  fileName: string;
  sourcePath: string;
  entries: AgentMemoryEntry[];
  file: AgentFileEntry | null;
};

function normalizeSourcePath(sourcePath: string): string {
  const trimmed = sourcePath.trim().replace(/\\/g, "/");
  if (!trimmed) return "";
  const memoryIndex = trimmed.lastIndexOf("/memory/");
  if (memoryIndex >= 0) return trimmed.slice(memoryIndex + 1);
  const memoryRootIndex = trimmed.lastIndexOf("/MEMORY.md");
  if (memoryRootIndex >= 0) return "MEMORY.md";
  const parts = trimmed.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? trimmed;
}

export function isAgentMemoryFileName(fileName: string): boolean {
  const trimmed = fileName.trim();
  return trimmed === "MEMORY.md" || trimmed.startsWith("memory/");
}

export function buildAgentMemoryFileGroups(params: {
  entries: AgentMemoryEntry[];
  files: AgentFileEntry[];
}): AgentMemoryFileGroup[] {
  const fileByName = new Map(
    params.files
      .filter((file) => isAgentMemoryFileName(file.name))
      .map((file) => [file.name, file]),
  );
  const grouped = new Map<string, AgentMemoryFileGroup>();

  for (const entry of params.entries) {
    const normalizedPath = normalizeSourcePath(entry.source.sourcePath);
    if (!normalizedPath) continue;
    const existing = grouped.get(normalizedPath);
    if (existing) {
      existing.entries.push(entry);
      continue;
    }
    grouped.set(normalizedPath, {
      key: normalizedPath,
      fileName: normalizedPath,
      sourcePath: entry.source.sourcePath,
      entries: [entry],
      file: fileByName.get(normalizedPath) ?? null,
    });
  }

  for (const file of params.files) {
    if (!isAgentMemoryFileName(file.name) || grouped.has(file.name)) continue;
    grouped.set(file.name, {
      key: file.name,
      fileName: file.name,
      sourcePath: file.path,
      entries: [],
      file,
    });
  }

  return [...grouped.values()].sort((left, right) => {
    const leftRank =
      left.fileName === "MEMORY.md" ? 0 : left.fileName.startsWith("memory/") ? 1 : 2;
    const rightRank =
      right.fileName === "MEMORY.md" ? 0 : right.fileName.startsWith("memory/") ? 1 : 2;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.fileName.localeCompare(right.fileName);
  });
}

export function getDefaultAgentMemoryFileName(groups: AgentMemoryFileGroup[]): string | null {
  return groups[0]?.fileName ?? null;
}

export function toUserFacingMemoryPanelError(
  errorText: string,
  scope: "entries" | "files",
): string {
  if (!errorText) return "";
  if (errorText.includes(":404")) return "This agent is not configured in OpenClaw yet.";
  if (errorText.includes("request_unreachable")) {
    return "The OpenClaw state bridge is unavailable right now.";
  }
  if (scope === "entries" && errorText.includes("memory_entries_load_failed")) {
    return "Unable to load parsed memory entries right now.";
  }
  if (scope === "files" && errorText.includes("file_load_failed")) {
    return "Unable to load the selected memory file right now.";
  }
  if (scope === "files" && errorText.includes("files_load_failed")) {
    return "Unable to load memory files right now.";
  }
  return scope === "entries"
    ? "Unable to load parsed memory entries right now."
    : "Unable to load memory files right now.";
}

export function getRawMemoryPreviewText(params: {
  activeGroup: AgentMemoryFileGroup | null;
  activeRawContent: string;
}): string {
  if (!params.activeGroup) return "Select a memory file to inspect raw content.";
  if (!params.activeGroup.file) return "Raw file preview is unavailable for this source.";
  return params.activeRawContent || "File is empty.";
}
