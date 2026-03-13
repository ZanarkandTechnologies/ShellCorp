import { describe, expect, it } from "vitest";

import {
  buildSkillEffectSeed,
  normalizeSkillEffectPool,
  resolveSkillEffectVariant,
} from "./skill-effects";

describe("skill effects", () => {
  it("uses a fixed effect when configured", () => {
    expect(
      resolveSkillEffectVariant(
        { effectMode: "fixed", effectVariant: "blink", effectPool: ["ghost"] },
        "agent-1|world-monitor|session-1",
      ),
    ).toBe("blink");
  });

  it("uses deterministic random selection for one seed", () => {
    const config = { effectMode: "random" as const, effectPool: ["ghost", "blink"] as const };
    const first = resolveSkillEffectVariant(config, "agent-1|world-monitor|session-1");
    const second = resolveSkillEffectVariant(config, "agent-1|world-monitor|session-1");
    expect(first).toBe(second);
  });

  it("falls back to both variants when the pool is empty", () => {
    expect(normalizeSkillEffectPool([])).toEqual(["ghost", "blink"]);
  });

  it("builds a stable seed that ignores updated timestamps", () => {
    expect(
      buildSkillEffectSeed({
        agentId: "shellcorp-pm",
        skillId: "world-monitor",
        sessionKey: "session-1",
      }),
    ).toBe("shellcorp-pm|world-monitor|session-1");
  });
});
