/**
 * SKILLS PANEL DATA
 * =================
 * Pure selectors for deriving grouped runtime/sidebar state for the Skills panel.
 *
 * KEY CONCEPTS:
 * - Sidebar grouping and agent-known skill IDs are computed outside the React container.
 * - Render components receive already-shaped view data instead of rebuilding it inline.
 *
 * USAGE:
 * - Imported by `skills-panel.tsx`.
 *
 * MEMORY REFERENCES:
 * - MEM-0205
 */

import type {
  AgentSkillsInventory,
  SkillStatusReport,
  SkillStudioCatalogEntry,
  SkillStudioDetail,
} from "@/lib/openclaw-types";
import type { GroupedInheritedRuntimeSkills, InheritedRuntimeSkillEntry } from "./skills-panel-types";

export function classifyRuntimeSourceLabel(source: string | undefined): string {
  const normalized = (source ?? "").trim().toLowerCase();
  if (normalized.includes("bundled")) return "OpenClaw Bundled";
  if (normalized.includes("managed")) return "OpenClaw Managed";
  if (normalized.includes("shared")) return "Shared Skills";
  if (normalized.includes("workspace")) return "Workspace Skills";
  return "Runtime Skills";
}

export function groupInheritedRuntimeSkills(
  entries: InheritedRuntimeSkillEntry[],
): GroupedInheritedRuntimeSkills {
  const groups = new Map<string, InheritedRuntimeSkillEntry[]>();
  for (const entry of entries) {
    const label = classifyRuntimeSourceLabel(entry.source);
    const existing = groups.get(label) ?? [];
    existing.push(entry);
    groups.set(label, existing);
  }
  return [...groups.entries()];
}

export function buildKnownAgentSkillIds(input: {
  skills: SkillStudioCatalogEntry[];
  workspaceSkills: AgentSkillsInventory["workspaceSkills"];
  inheritedRuntimeSkills: InheritedRuntimeSkillEntry[];
  selectedDetail: SkillStudioDetail | null;
}): string[] {
  const ids = new Set<string>();
  for (const entry of input.skills) ids.add(entry.skillId);
  for (const entry of input.workspaceSkills) ids.add(entry.skillId);
  for (const entry of input.inheritedRuntimeSkills) ids.add(entry.skillKey || entry.name);
  if (input.selectedDetail?.skillId) ids.add(input.selectedDetail.skillId);
  return [...ids].sort((a, b) => a.localeCompare(b));
}

export function findRuntimeStatusForDetail(
  report: SkillStatusReport | null,
  detail: SkillStudioDetail | null,
): SkillStatusReport["skills"][number] | null {
  if (!report || !detail) return null;
  return (
    report.skills.find(
      (entry) => entry.name === detail.skillId || entry.skillKey === detail.skillId,
    ) ?? null
  );
}
