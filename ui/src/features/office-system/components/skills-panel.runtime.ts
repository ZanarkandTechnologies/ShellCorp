/**
 * SKILLS PANEL RUNTIME HELPERS
 * ============================
 * Pure helpers for separating repo catalog skills from runtime availability.
 *
 * KEY CONCEPTS:
 * - Global config lives under `openclaw.json.skills.entries`.
 * - Agent workspace skills are distinct from inherited shared/runtime skills.
 *
 * USAGE:
 * - Imported by Skill Studio and covered by focused unit tests.
 *
 * MEMORY REFERENCES:
 * - MEM-0203
 */

import type { GlobalSkillsInventory, SkillStatusReport } from "@/lib/openclaw-types";

export type GlobalSkillRow = {
  skillKey: string;
  enabled: boolean | null;
  hasSharedInstall: boolean;
  envCount: number;
  configCount: number;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function resolveSkillsEntries(
  config: Record<string, unknown> | null,
): Record<string, Record<string, unknown>> {
  const skillsNode =
    config?.skills && typeof config.skills === "object"
      ? (config.skills as Record<string, unknown>)
      : {};
  const entriesNode =
    skillsNode.entries && typeof skillsNode.entries === "object"
      ? (skillsNode.entries as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    Object.entries(entriesNode)
      .filter(([, value]) => value && typeof value === "object")
      .map(([key, value]) => [key, value as Record<string, unknown>]),
  );
}

export function buildNextGlobalSkillConfig(
  currentConfig: Record<string, unknown>,
  skillKey: string,
  enabled: boolean,
): Record<string, unknown> {
  const next = cloneJson(currentConfig);
  const root = next as Record<string, unknown>;
  const skillsNode =
    root.skills && typeof root.skills === "object"
      ? (cloneJson(root.skills) as Record<string, unknown>)
      : {};
  const entriesNode =
    skillsNode.entries && typeof skillsNode.entries === "object"
      ? (cloneJson(skillsNode.entries) as Record<string, unknown>)
      : {};
  const currentEntry =
    entriesNode[skillKey] && typeof entriesNode[skillKey] === "object"
      ? (cloneJson(entriesNode[skillKey]) as Record<string, unknown>)
      : {};
  entriesNode[skillKey] = { ...currentEntry, enabled };
  skillsNode.entries = entriesNode;
  root.skills = skillsNode;
  return root;
}

export function buildInheritedRuntimeSkillKeys(
  skillsReport: SkillStatusReport | null,
  workspaceSkillIds: Set<string>,
): string[] {
  if (!skillsReport) return [];
  const seen = new Set<string>();
  return skillsReport.skills
    .filter((entry) => {
      const key = entry.skillKey || entry.name;
      if (!key || workspaceSkillIds.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((entry) => entry.skillKey || entry.name);
}

export function buildGlobalSkillRows(
  configSnapshot: Record<string, unknown> | null,
  globalInventory: GlobalSkillsInventory | null,
): GlobalSkillRow[] {
  const entries = resolveSkillsEntries(configSnapshot);
  const keys = new Set([
    ...Object.keys(entries),
    ...(globalInventory?.sharedSkills ?? []).map((entry) => entry.skillId),
  ]);
  return [...keys]
    .map((skillKey) => {
      const configEntry = entries[skillKey] ?? {};
      const envNode =
        configEntry.env && typeof configEntry.env === "object"
          ? (configEntry.env as Record<string, unknown>)
          : {};
      const configNode =
        configEntry.config && typeof configEntry.config === "object"
          ? (configEntry.config as Record<string, unknown>)
          : {};
      return {
        skillKey,
        enabled: typeof configEntry.enabled === "boolean" ? (configEntry.enabled as boolean) : null,
        hasSharedInstall: (globalInventory?.sharedSkills ?? []).some(
          (entry) => entry.skillId === skillKey,
        ),
        envCount: Object.keys(envNode).length,
        configCount: Object.keys(configNode).length,
      } satisfies GlobalSkillRow;
    })
    .sort((a, b) => a.skillKey.localeCompare(b.skillKey));
}
