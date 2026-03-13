import { describe, expect, it } from "vitest";

import type { AgentConfigDraft } from "@/features/office-system/components/manage-agent-modal/_types";

import {
  getCustomSelectionDraft,
  isSkillEquipped,
  toggleSidebarSkill,
} from "./skills-panel.helpers";

const BASE_DRAFT: AgentConfigDraft = {
  primaryModel: "",
  fallbackModels: "",
  toolsProfile: "",
  toolsAllow: [],
  toolsDeny: [],
  skillsMode: "all",
  selectedSkills: [],
};

describe("skills panel sidebar helpers", () => {
  it("treats all-mode skills as equipped", () => {
    expect(isSkillEquipped(BASE_DRAFT, "morning-report")).toBe(true);
  });

  it("promotes all-mode into selected-mode when a skill is unequipped", () => {
    const next = toggleSidebarSkill(BASE_DRAFT, "daily-brief", [
      "morning-report",
      "daily-brief",
      "future-me",
    ]);
    expect(next.skillsMode).toBe("selected");
    expect(next.selectedSkills).toEqual(["morning-report", "future-me"]);
  });

  it("promotes none-mode into selected-mode when a skill is equipped", () => {
    const next = toggleSidebarSkill(
      {
        ...BASE_DRAFT,
        skillsMode: "none",
      },
      "future-me",
      ["morning-report", "future-me"],
    );
    expect(next).toEqual({
      ...BASE_DRAFT,
      skillsMode: "selected",
      selectedSkills: ["future-me"],
    });
  });

  it("snapshots the known catalog when switching all-mode into custom mode", () => {
    const next = getCustomSelectionDraft(BASE_DRAFT, ["alpha", "beta", "alpha"]);
    expect(next).toEqual({
      ...BASE_DRAFT,
      skillsMode: "selected",
      selectedSkills: ["alpha", "beta"],
    });
  });
});
