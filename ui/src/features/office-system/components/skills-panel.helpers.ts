/**
 * SKILL STUDIO SIDEBAR HELPERS
 * ============================
 * Pure helpers for deriving and updating per-agent skill selections inside the
 * Skill Studio sidebar.
 *
 * KEY CONCEPTS:
 * - `all` means every known skill is treated as equipped until the user opts into custom mode.
 * - Toggling a skill while in `all` snapshots the known catalog into a selected allowlist.
 * - Toggling a skill while in `none` promotes the draft into a one-skill selected allowlist.
 *
 * USAGE:
 * - Used by Skill Studio and covered by focused unit tests.
 *
 * MEMORY REFERENCES:
 * - MEM-0188
 */

import type { AgentConfigDraft } from "@/features/office-system/components/manage-agent-modal/_types";

function dedupeSkills(skillIds: string[]): string[] {
  return [...new Set(skillIds.filter((skillId) => skillId.trim().length > 0))];
}

export function isSkillEquipped(draft: AgentConfigDraft, skillId: string): boolean {
  if (draft.skillsMode === "all") return true;
  if (draft.skillsMode === "none") return false;
  return draft.selectedSkills.includes(skillId);
}

export function getCustomSelectionDraft(
  draft: AgentConfigDraft,
  availableSkillIds: string[],
): AgentConfigDraft {
  if (draft.skillsMode === "selected") {
    return {
      ...draft,
      selectedSkills: dedupeSkills(draft.selectedSkills),
    };
  }
  if (draft.skillsMode === "all") {
    return {
      ...draft,
      skillsMode: "selected",
      selectedSkills: dedupeSkills(availableSkillIds),
    };
  }
  return {
    ...draft,
    skillsMode: "selected",
    selectedSkills: [],
  };
}

export function toggleSidebarSkill(
  draft: AgentConfigDraft,
  skillId: string,
  availableSkillIds: string[],
): AgentConfigDraft {
  const selected = new Set(
    draft.skillsMode === "all" ? dedupeSkills(availableSkillIds) : draft.selectedSkills,
  );
  if (isSkillEquipped(draft, skillId)) {
    selected.delete(skillId);
  } else {
    selected.add(skillId);
  }
  return {
    ...draft,
    skillsMode: "selected",
    selectedSkills: [...selected],
  };
}
