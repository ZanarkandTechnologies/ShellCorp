import { describe, expect, it } from "vitest";

import { toggleSidebarSkill } from "../skills-panel.helpers";

import {
  buildNextAgentConfig,
  EMPTY_AGENT_CONFIG_DRAFT,
  resolveAgentConfigDraft,
} from "./config-draft";

describe("manage agent config draft helpers", () => {
  it("round-trips a selected-skill allowlist for one agent without touching neighbors", () => {
    const currentConfig = {
      agents: {
        list: [
          {
            id: "agent-alpha",
            model: {
              primary: "gpt-5",
              fallbacks: ["gpt-4.1"],
            },
            tools: {
              profile: "default",
              alsoAllow: ["shell"],
              deny: ["browser"],
            },
            skills: ["morning-report", "daily-brief"],
          },
          {
            id: "agent-beta",
            skills: ["leave-me-alone"],
          },
        ],
      },
    } satisfies Record<string, unknown>;

    const draft = resolveAgentConfigDraft(currentConfig, "agent-alpha");
    expect(draft).toEqual({
      ...EMPTY_AGENT_CONFIG_DRAFT,
      primaryModel: "gpt-5",
      fallbackModels: "gpt-4.1",
      toolsProfile: "default",
      toolsAllow: ["shell"],
      toolsDeny: ["browser"],
      skillsMode: "selected",
      selectedSkills: ["morning-report", "daily-brief"],
    });

    const nextConfig = buildNextAgentConfig(currentConfig, "agent-alpha", {
      ...draft,
      fallbackModels: "gpt-4.1, claude-sonnet",
      selectedSkills: ["future-me"],
    });

    expect(resolveAgentConfigDraft(nextConfig, "agent-alpha")).toEqual({
      ...EMPTY_AGENT_CONFIG_DRAFT,
      primaryModel: "gpt-5",
      fallbackModels: "gpt-4.1, claude-sonnet",
      toolsProfile: "default",
      toolsAllow: ["shell"],
      toolsDeny: ["browser"],
      skillsMode: "selected",
      selectedSkills: ["future-me"],
    });
    expect(resolveAgentConfigDraft(nextConfig, "agent-beta")).toEqual({
      ...EMPTY_AGENT_CONFIG_DRAFT,
      skillsMode: "selected",
      selectedSkills: ["leave-me-alone"],
    });
  });

  it("treats missing skills as use-all and empty skills as disable-all", () => {
    const noSkillsConfig = {
      agents: {
        list: [{ id: "agent-alpha" }],
      },
    } satisfies Record<string, unknown>;

    expect(resolveAgentConfigDraft(noSkillsConfig, "agent-alpha")).toEqual(
      EMPTY_AGENT_CONFIG_DRAFT,
    );

    const disabledConfig = buildNextAgentConfig(noSkillsConfig, "agent-alpha", {
      ...EMPTY_AGENT_CONFIG_DRAFT,
      skillsMode: "none",
    });
    expect(resolveAgentConfigDraft(disabledConfig, "agent-alpha")).toEqual({
      ...EMPTY_AGENT_CONFIG_DRAFT,
      skillsMode: "none",
    });
  });

  it("supports disabling one inherited skill for a single agent without touching global skill entries", () => {
    const currentConfig = {
      skills: {
        entries: {
          "1password": { enabled: true },
        },
      },
      agents: {
        list: [{ id: "agent-alpha" }, { id: "agent-beta", skills: ["keep-me"] }],
      },
    } satisfies Record<string, unknown>;

    const nextDraft = toggleSidebarSkill(
      resolveAgentConfigDraft(currentConfig, "agent-alpha"),
      "1password",
      ["1password", "apple-notes"],
    );
    const nextConfig = buildNextAgentConfig(currentConfig, "agent-alpha", nextDraft);

    expect(resolveAgentConfigDraft(nextConfig, "agent-alpha")).toEqual({
      ...EMPTY_AGENT_CONFIG_DRAFT,
      skillsMode: "selected",
      selectedSkills: ["apple-notes"],
    });
    expect(resolveAgentConfigDraft(nextConfig, "agent-beta")).toEqual({
      ...EMPTY_AGENT_CONFIG_DRAFT,
      skillsMode: "selected",
      selectedSkills: ["keep-me"],
    });
    expect(nextConfig).toMatchObject({
      skills: {
        entries: {
          "1password": { enabled: true },
        },
      },
    });
  });

  it("reads inherited heartbeat defaults and only writes the per-agent cadence override", () => {
    const currentConfig = {
      agents: {
        defaults: {
          heartbeat: {
            every: "10m",
            includeReasoning: true,
            target: "last",
            prompt: "Read HEARTBEAT.md and follow it exactly.",
          },
        },
        list: [
          {
            id: "agent-alpha",
            heartbeat: {
              every: "1m",
            },
          },
          {
            id: "agent-beta",
          },
        ],
      },
    } satisfies Record<string, unknown>;

    expect(resolveAgentConfigDraft(currentConfig, "agent-alpha")).toEqual({
      ...EMPTY_AGENT_CONFIG_DRAFT,
      heartbeatEveryOverride: "1m",
      heartbeatDefaultEvery: "10m",
      heartbeatIncludeReasoning: true,
      heartbeatTarget: "last",
      heartbeatPrompt: "Read HEARTBEAT.md and follow it exactly.",
    });

    expect(resolveAgentConfigDraft(currentConfig, "agent-beta")).toEqual({
      ...EMPTY_AGENT_CONFIG_DRAFT,
      heartbeatDefaultEvery: "10m",
      heartbeatIncludeReasoning: true,
      heartbeatTarget: "last",
      heartbeatPrompt: "Read HEARTBEAT.md and follow it exactly.",
    });

    const nextConfig = buildNextAgentConfig(currentConfig, "agent-alpha", {
      ...resolveAgentConfigDraft(currentConfig, "agent-alpha"),
      heartbeatEveryOverride: "",
    });

    expect(resolveAgentConfigDraft(nextConfig, "agent-alpha")).toEqual({
      ...EMPTY_AGENT_CONFIG_DRAFT,
      heartbeatDefaultEvery: "10m",
      heartbeatIncludeReasoning: true,
      heartbeatTarget: "last",
      heartbeatPrompt: "Read HEARTBEAT.md and follow it exactly.",
    });
    expect(nextConfig).toMatchObject({
      agents: {
        defaults: {
          heartbeat: {
            every: "10m",
            includeReasoning: true,
            target: "last",
            prompt: "Read HEARTBEAT.md and follow it exactly.",
          },
        },
      },
    });
    expect(
      (
        (
          (nextConfig.agents as Record<string, unknown>).list as Array<Record<string, unknown>>
        ).find((entry) => entry.id === "agent-alpha")?.heartbeat as
          | Record<string, unknown>
          | undefined
      )?.every,
    ).toBeUndefined();
  });
});
