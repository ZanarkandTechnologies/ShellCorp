/**
 * SKILL CONTRACT TESTS
 * ====================
 * Execute file-based markdown skill procedures against the local ShellCorp CLI.
 *
 * KEY CONCEPTS:
 * - Skills remain human-readable markdown files.
 * - Each executable contract test lives beside a skill in tests/*.md.
 * - A fenced `json skill-test` block defines CLI steps and expected state.
 *
 * USAGE:
 * - pnpm run test:skills
 *
 * MEMORY REFERENCES:
 * - MEM-0157
 */

import { access, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerDoctorCommands, registerTeamCommands } from "../cli/team-commands/index.js";

type ProposalSummary = {
  id: string;
  approvalStatus: string;
  executionStatus: string;
};

type CompanySnapshot = {
  projects: Array<{ id: string }>;
  agents: Array<{ agentId?: string }>;
  teamProposals?: ProposalSummary[];
};

type SkillStepExpectation = {
  stdoutIncludes?: string[];
  stderrIncludes?: string[];
  companyProjectIdsInclude?: string[];
  companyProposalCount?: number;
  companyProposalStates?: Array<Partial<ProposalSummary>>;
  openclawAgentIdsInclude?: string[];
  filesExist?: string[];
};

type SkillStepSpec = {
  run: string[];
  expect?: SkillStepExpectation;
  captureLatestProposalId?: boolean;
};

type SkillContractSpec = {
  name: string;
  steps: SkillStepSpec[];
};

const baseCompany = {
  version: 1,
  departments: [
    { id: "dept-ceo", name: "CEO Office", description: "", goal: "" },
    { id: "dept-products", name: "Product Studio", description: "", goal: "" },
  ],
  projects: [],
  agents: [{ agentId: "main", role: "ceo", heartbeatProfileId: "hb-ceo", isCeo: true, lifecycleState: "active" }],
  roleSlots: [],
  heartbeatProfiles: [
    { id: "hb-ceo", role: "ceo", cadenceMinutes: 15, teamDescription: "", productDetails: "", goal: "" },
    { id: "hb-builder", role: "builder", cadenceMinutes: 10, teamDescription: "", productDetails: "", goal: "" },
    { id: "hb-growth", role: "growth_marketer", cadenceMinutes: 20, teamDescription: "", productDetails: "", goal: "" },
    { id: "hb-pm", role: "pm", cadenceMinutes: 10, teamDescription: "", productDetails: "", goal: "" },
  ],
  tasks: [],
  channelBindings: [],
  federationPolicies: [],
  providerIndexProfiles: [],
};

type ExecutionContext = {
  latestProposalId: string | null;
};

async function setupStateDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "shellcorp-skill-test-"));
  await writeFile(path.join(dir, "company.json"), `${JSON.stringify(baseCompany, null, 2)}\n`, "utf-8");
  await writeFile(path.join(dir, "office-objects.json"), "[]\n", "utf-8");
  await writeFile(
    path.join(dir, "openclaw.json"),
    `${JSON.stringify(
      {
        version: 1,
        agents: {
          list: [
            {
              id: "main",
              name: "Main",
              workspace: path.join(dir, "workspace"),
              agentDir: path.join(dir, "agents", "main", "agent"),
            },
          ],
        },
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
  return dir;
}

async function runCommand(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((...parts: unknown[]) => {
    stdoutLines.push(parts.map(String).join(" "));
  });
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => {
    stderrLines.push(parts.map(String).join(" "));
  });
  try {
    const program = new Command();
    registerTeamCommands(program);
    registerDoctorCommands(program);
    await program.parseAsync(args, { from: "user" });
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }
  return {
    stdout: stdoutLines.join("\n"),
    stderr: stderrLines.join("\n"),
  };
}

async function readCompany(stateDir: string): Promise<CompanySnapshot> {
  const raw = await readFile(path.join(stateDir, "company.json"), "utf-8");
  return JSON.parse(raw) as CompanySnapshot;
}

async function readOpenclawAgentIds(stateDir: string): Promise<string[]> {
  const raw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
  const config = JSON.parse(raw) as {
    agents?: { list?: Array<{ id?: string }> };
  };
  return (config.agents?.list ?? []).map((entry) => entry.id ?? "").filter(Boolean);
}

function extractContract(markdown: string): SkillContractSpec {
  const match = markdown.match(/```json skill-test\s*([\s\S]*?)```/);
  if (!match) {
    throw new Error("Missing ```json skill-test``` block.");
  }
  return JSON.parse(match[1]) as SkillContractSpec;
}

function substituteArgs(args: string[], context: ExecutionContext): string[] {
  return args.map((arg) => {
    if (arg === "$LATEST_PROPOSAL_ID") {
      if (!context.latestProposalId) {
        throw new Error("No latest proposal id captured for $LATEST_PROPOSAL_ID.");
      }
      return context.latestProposalId;
    }
    return arg;
  });
}

async function assertExpectations(expectation: SkillStepExpectation | undefined, stateDir: string, stdout: string, stderr: string): Promise<void> {
  if (!expectation) {
    return;
  }
  for (const needle of expectation.stdoutIncludes ?? []) {
    expect(stdout).toContain(needle);
  }
  for (const needle of expectation.stderrIncludes ?? []) {
    expect(stderr).toContain(needle);
  }
  const company = await readCompany(stateDir);
  const projectIds = company.projects.map((project) => project.id);
  for (const projectId of expectation.companyProjectIdsInclude ?? []) {
    expect(projectIds).toContain(projectId);
  }
  if (typeof expectation.companyProposalCount === "number") {
    expect(company.teamProposals ?? []).toHaveLength(expectation.companyProposalCount);
  }
  for (const expectedProposal of expectation.companyProposalStates ?? []) {
    expect(company.teamProposals ?? []).toEqual(expect.arrayContaining([expect.objectContaining(expectedProposal)]));
  }
  const agentIds = await readOpenclawAgentIds(stateDir);
  for (const agentId of expectation.openclawAgentIdsInclude ?? []) {
    expect(agentIds).toContain(agentId);
  }
  for (const relativePath of expectation.filesExist ?? []) {
    await access(path.join(stateDir, relativePath));
  }
}

async function collectSkillTests(rootDir: string): Promise<Array<{ name: string; filePath: string; spec: SkillContractSpec }>> {
  const skillNames = await readdir(rootDir);
  const cases: Array<{ name: string; filePath: string; spec: SkillContractSpec }> = [];
  for (const skillName of skillNames) {
    const testsDir = path.join(rootDir, skillName, "tests");
    let files: string[] = [];
    try {
      files = await readdir(testsDir);
    } catch {
      continue;
    }
    for (const fileName of files.filter((entry) => entry.endsWith(".md"))) {
      const filePath = path.join(testsDir, fileName);
      const markdown = await readFile(filePath, "utf-8");
      cases.push({
        name: `${skillName}/${fileName}`,
        filePath,
        spec: extractContract(markdown),
      });
    }
  }
  return cases;
}

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
  const cases = await collectSkillTests(path.join(process.cwd(), "skills"));
  for (const testCase of cases) {
    it(`executes ${testCase.name}`, async () => {
      const stateDir = await setupStateDir();
      process.env.OPENCLAW_STATE_DIR = stateDir;
      const context: ExecutionContext = { latestProposalId: null };

      for (const step of testCase.spec.steps) {
        const args = substituteArgs(step.run, context);
        const result = await runCommand(args);
        if (step.captureLatestProposalId) {
          const company = await readCompany(stateDir);
          context.latestProposalId = company.teamProposals?.at(-1)?.id ?? null;
        }
        await assertExpectations(step.expect, stateDir, result.stdout, result.stderr);
      }
    });
  }
});
