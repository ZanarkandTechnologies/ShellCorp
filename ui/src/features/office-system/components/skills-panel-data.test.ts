import { describe, expect, it } from "vitest";

import {
  buildRuntimeOnlySkillDetail,
  buildVisibleGlobalSkillRows,
  joinLines,
  mergeRuntimeStatus,
  splitLines,
} from "./skills-panel-data";

describe("skills panel data helpers", () => {
  it("merges runtime status onto matching catalog entries", () => {
    const next = mergeRuntimeStatus(
      [
        {
          skillId: "peekaboo",
          packageKey: "peekaboo",
          displayName: "Peekaboo",
          description: "test skill",
          category: "demo",
          scope: "shared",
          sourcePath: "/repo/skills/peekaboo",
          updatedAt: 1,
          hasManifest: true,
          hasTests: true,
          hasDiagram: false,
          hasSkillMemory: false,
        },
      ],
      {
        workspaceDir: "/tmp/agent",
        managedSkillsDir: "/tmp/shared",
        skills: [
          {
            name: "peekaboo",
            skillKey: "peekaboo",
            description: "runtime row",
            source: "shared",
            filePath: "/tmp/shared/peekaboo/SKILL.md",
            baseDir: "/tmp/shared/peekaboo",
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
    );

    expect(next[0]?.runtimeStatus).toEqual({
      eligible: true,
      blockedByAllowlist: false,
      disabled: false,
      source: "shared",
    });
  });

  it("keeps shared installs visible while hiding empty config-only rows", () => {
    const visible = buildVisibleGlobalSkillRows(
      [
        {
          skillKey: "peekaboo",
          enabled: null,
          hasSharedInstall: true,
          envCount: 0,
          configCount: 0,
        },
        {
          skillKey: "ghost-row",
          enabled: null,
          hasSharedInstall: false,
          envCount: 0,
          configCount: 0,
        },
      ],
      [{ skillId: "peekaboo", sourcePath: "/tmp/shared/peekaboo", scope: "shared" }],
      "",
    );

    expect(visible).toEqual([
      {
        skillKey: "peekaboo",
        enabled: null,
        hasSharedInstall: true,
        envCount: 0,
        configCount: 0,
      },
    ]);
  });

  it("builds a runtime-only fallback detail when repo metadata is unavailable", () => {
    const detail = buildRuntimeOnlySkillDetail({
      skillId: "peekaboo",
      runtimeStatus: {
        name: "peekaboo",
        skillKey: "peekaboo",
        description: "runtime row",
        source: "shared",
        filePath: "/tmp/shared/peekaboo/SKILL.md",
        baseDir: "/tmp/shared/peekaboo",
        always: false,
        disabled: false,
        blockedByAllowlist: false,
        eligible: true,
        requirements: { bins: [], env: [], config: [], os: [] },
        missing: { bins: [], env: [], config: [], os: [] },
        configChecks: [],
        install: [],
      },
      focusAgentId: "agent-1",
    });

    expect(detail).toMatchObject({
      skillId: "peekaboo",
      scope: "agent",
      hasManifest: false,
      sourcePath: "/tmp/shared/peekaboo/SKILL.md",
      focusAgentId: "agent-1",
    });
    expect(detail.manifest.interface.displayName).toBe("peekaboo");
  });

  it("normalizes multi-line manifest fields", () => {
    expect(splitLines(" alpha\n\n beta \n")).toEqual(["alpha", "beta"]);
    expect(joinLines(["alpha", "beta"])).toBe("alpha\nbeta");
  });
});
