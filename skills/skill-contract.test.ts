/**
 * SKILL CONTRACT TESTS
 * ====================
 * Execute file-based markdown skill procedures against the local ShellCorp CLI.
 *
 * KEY CONCEPTS:
 * - Shared runtime helpers keep tests and UI demos on the same execution contract.
 * - Each executable contract test lives beside a skill in tests/*.md.
 * - A fenced `json skill-test` block defines CLI steps and expected state.
 *
 * USAGE:
 * - pnpm run test:skills
 *
 * MEMORY REFERENCES:
 * - MEM-0157
 * - MEM-0166
 */

import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collectSkillContractTests, runSkillContractSpec, setupSkillTestStateDir } from "./skill-contract-runtime";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.OPENCLAW_STATE_DIR;
  delete process.env.SHELLCORP_CONVEX_SITE_URL;
  delete process.env.CONVEX_SITE_URL;
  delete process.env.SHELLCORP_ACTOR_ROLE;
  delete process.env.SHELLCORP_ALLOWED_PERMISSIONS;
  delete process.env.SHELLCORP_BOARD_OPERATOR_TOKEN;
  delete process.env.SHELLCORP_AGENT_ID;
  delete process.env.SHELLCORP_TEAM_ID;
  process.exitCode = undefined;
});

describe("skill contract tests", async () => {
  const cases = await collectSkillContractTests(path.join(process.cwd(), "skills"));
  for (const testCase of cases) {
    it(`executes ${testCase.name}`, async () => {
      const stateDir = await setupSkillTestStateDir();
      const result = await runSkillContractSpec(testCase.spec, stateDir);
      expect(result.passed).toBe(true);
      for (const step of result.steps) {
        expect(step.expectation.failures).toEqual([]);
      }
    });
  }
});
