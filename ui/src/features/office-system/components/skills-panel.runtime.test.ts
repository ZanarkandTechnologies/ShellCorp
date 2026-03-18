import { describe, expect, it } from "vitest";
import {
  buildGlobalSkillRows,
  buildInheritedRuntimeSkillKeys,
  buildNextGlobalSkillConfig,
} from "./skills-panel.runtime";

describe("skills-panel runtime helpers", () => {
  it("writes global skill enabled state without dropping sibling config", () => {
    const currentConfig = {
      skills: {
        entries: {
          peekaboo: {
            enabled: false,
            config: { model: "nano" },
          },
        },
      },
    };

    const nextConfig = buildNextGlobalSkillConfig(currentConfig, "peekaboo", true);

    expect(nextConfig).toEqual({
      skills: {
        entries: {
          peekaboo: {
            enabled: true,
            config: { model: "nano" },
          },
        },
      },
    });
  });

  it("excludes workspace-installed skills from inherited runtime keys", () => {
    const inherited = buildInheritedRuntimeSkillKeys(
      {
        workspaceDir: "/tmp/agent",
        managedSkillsDir: "/tmp/shared",
        skills: [
          {
            name: "create-team",
            skillKey: "create-team",
            description: "",
            source: "workspace",
            filePath: "",
            baseDir: "",
            always: false,
            disabled: false,
            blockedByAllowlist: false,
            eligible: true,
            requirements: { bins: [], env: [], config: [], os: [] },
            missing: { bins: [], env: [], config: [], os: [] },
            configChecks: [],
            install: [],
          },
          {
            name: "peekaboo",
            skillKey: "peekaboo",
            description: "",
            source: "shared",
            filePath: "",
            baseDir: "",
            always: false,
            disabled: false,
            blockedByAllowlist: false,
            eligible: true,
            requirements: { bins: [], env: [], config: [], os: [] },
            missing: { bins: [], env: [], config: [], os: [] },
            configChecks: [],
            install: [],
          },
        ],
      },
      new Set(["create-team"]),
    );

    expect(inherited).toEqual(["peekaboo"]);
  });

  it("merges shared installs with global config rows", () => {
    const rows = buildGlobalSkillRows(
      {
        skills: {
          entries: {
            peekaboo: { enabled: false, env: { API_KEY: "x" } },
          },
        },
      },
      {
        sharedSkills: [{ skillId: "peekaboo", sourcePath: "/tmp/shared/peekaboo", scope: "shared" }],
      },
    );

    expect(rows).toEqual([
      {
        skillKey: "peekaboo",
        enabled: false,
        hasSharedInstall: true,
        envCount: 1,
        configCount: 0,
      },
    ]);
  });
});
