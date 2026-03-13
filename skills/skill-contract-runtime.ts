/**
 * SKILL CONTRACT RUNTIME
 * ======================
 * Shared runtime helpers for file-based skill contract discovery and execution.
 *
 * KEY CONCEPTS:
 * - Skill demos and tests both reuse the same markdown `json skill-test` contract.
 * - Execution happens against a temporary local ShellCorp state dir.
 * - Results are returned step-by-step so UI callers can inspect the workflow.
 *
 * USAGE:
 * - Import from tests or the state bridge when listing/running skill demos.
 *
 * MEMORY REFERENCES:
 * - MEM-0157
 * - MEM-0166
 */

import { access, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { registerDoctorCommands, registerTeamCommands } from "../cli/team-commands/index.js";

export type ProposalSummary = {
  id: string;
  approvalStatus: string;
  executionStatus: string;
};

export type CompanySnapshot = {
  projects: Array<{ id: string }>;
  agents: Array<{ agentId?: string }>;
  teamProposals?: ProposalSummary[];
};

export type SkillStepExpectation = {
  stdoutIncludes?: string[];
  stderrIncludes?: string[];
  companyProjectIdsInclude?: string[];
  companyProposalCount?: number;
  companyProposalStates?: Array<Partial<ProposalSummary>>;
  openclawAgentIdsInclude?: string[];
  filesExist?: string[];
};

export type SkillStepSpec = {
  run: string[];
  expect?: SkillStepExpectation;
  captureLatestProposalId?: boolean;
};

export type SkillContractSpec = {
  name: string;
  steps: SkillStepSpec[];
};

export type SkillStepExpectationResult = {
  passed: boolean;
  failures: string[];
};

export type SkillContractStepResult = {
  run: string[];
  stdout: string;
  stderr: string;
  durationMs: number;
  expectation: SkillStepExpectationResult;
};

export type SkillContractRunResult = {
  name: string;
  passed: boolean;
  durationMs: number;
  stateDir: string;
  steps: SkillContractStepResult[];
};

type ExecutionContext = {
  latestProposalId: string | null;
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

export async function setupSkillTestStateDir(): Promise<string> {
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
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...parts: unknown[]) => {
    stdoutLines.push(parts.map(String).join(" "));
  };
  console.error = (...parts: unknown[]) => {
    stderrLines.push(parts.map(String).join(" "));
  };
  try {
    const program = new Command();
    registerTeamCommands(program);
    registerDoctorCommands(program);
    await program.parseAsync(args, { from: "user" });
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  return {
    stdout: stdoutLines.join("\n"),
    stderr: stderrLines.join("\n"),
  };
}

export async function readSkillTestCompany(stateDir: string): Promise<CompanySnapshot> {
  const raw = await readFile(path.join(stateDir, "company.json"), "utf-8");
  return JSON.parse(raw) as CompanySnapshot;
}

export async function readOpenclawAgentIds(stateDir: string): Promise<string[]> {
  const raw = await readFile(path.join(stateDir, "openclaw.json"), "utf-8");
  const config = JSON.parse(raw) as {
    agents?: { list?: Array<{ id?: string }> };
  };
  return (config.agents?.list ?? []).map((entry) => entry.id ?? "").filter(Boolean);
}

export function extractSkillContract(markdown: string): SkillContractSpec {
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

async function evaluateExpectation(
  expectation: SkillStepExpectation | undefined,
  stateDir: string,
  stdout: string,
  stderr: string,
): Promise<SkillStepExpectationResult> {
  const failures: string[] = [];
  if (!expectation) {
    return { passed: true, failures };
  }

  for (const needle of expectation.stdoutIncludes ?? []) {
    if (!stdout.includes(needle)) failures.push(`missing stdout text: ${needle}`);
  }
  for (const needle of expectation.stderrIncludes ?? []) {
    if (!stderr.includes(needle)) failures.push(`missing stderr text: ${needle}`);
  }

  const company = await readSkillTestCompany(stateDir);
  const projectIds = company.projects.map((project) => project.id);
  for (const projectId of expectation.companyProjectIdsInclude ?? []) {
    if (!projectIds.includes(projectId)) failures.push(`missing project id: ${projectId}`);
  }
  if (typeof expectation.companyProposalCount === "number") {
    const proposalCount = company.teamProposals?.length ?? 0;
    if (proposalCount !== expectation.companyProposalCount) {
      failures.push(`proposal count mismatch: expected ${expectation.companyProposalCount}, got ${proposalCount}`);
    }
  }
  for (const expectedProposal of expectation.companyProposalStates ?? []) {
    const matched = (company.teamProposals ?? []).some((proposal) =>
      Object.entries(expectedProposal).every(([key, value]) => proposal[key as keyof ProposalSummary] === value),
    );
    if (!matched) {
      failures.push(`missing proposal state: ${JSON.stringify(expectedProposal)}`);
    }
  }

  const agentIds = await readOpenclawAgentIds(stateDir);
  for (const agentId of expectation.openclawAgentIdsInclude ?? []) {
    if (!agentIds.includes(agentId)) failures.push(`missing runtime agent: ${agentId}`);
  }
  for (const relativePath of expectation.filesExist ?? []) {
    try {
      await access(path.join(stateDir, relativePath));
    } catch {
      failures.push(`missing file: ${relativePath}`);
    }
  }
  return {
    passed: failures.length === 0,
    failures,
  };
}

function isSkillTestFile(fileName: string): boolean {
  return fileName.endsWith(".md");
}

async function collectSkillTestFiles(rootDir: string): Promise<string[]> {
  const stack = [rootDir];
  const files: string[] = [];
  while (stack.length > 0) {
    const currentDir = stack.pop() ?? "";
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (!isSkillTestFile(entry.name)) continue;
      files.push(entryPath);
    }
  }
  return files.sort();
}

export async function collectSkillContractTests(
  rootDir: string,
): Promise<Array<{ name: string; filePath: string; spec: SkillContractSpec }>> {
  const cases: Array<{ name: string; filePath: string; spec: SkillContractSpec }> = [];
  const testFiles = await collectSkillTestFiles(rootDir);
  for (const filePath of testFiles.filter((entry) => entry.includes(`${path.sep}tests${path.sep}`))) {
    const markdown = await readFile(filePath, "utf-8");
    const relative = path.relative(rootDir, filePath).replace(/\\/g, "/");
    cases.push({
      name: relative,
      filePath,
      spec: extractSkillContract(markdown),
    });
  }
  return cases;
}

export async function runSkillContractSpec(
  spec: SkillContractSpec,
  stateDir: string,
): Promise<SkillContractRunResult> {
  const originalStateDir = process.env.OPENCLAW_STATE_DIR;
  process.env.OPENCLAW_STATE_DIR = stateDir;
  const context: ExecutionContext = { latestProposalId: null };
  const startedAt = Date.now();
  const steps: SkillContractStepResult[] = [];

  try {
    for (const step of spec.steps) {
      const args = substituteArgs(step.run, context);
      const stepStartedAt = Date.now();
      const result = await runCommand(args);
      if (step.captureLatestProposalId) {
        const company = await readSkillTestCompany(stateDir);
        context.latestProposalId = company.teamProposals?.at(-1)?.id ?? null;
      }
      const expectation = await evaluateExpectation(step.expect, stateDir, result.stdout, result.stderr);
      steps.push({
        run: args,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: Date.now() - stepStartedAt,
        expectation,
      });
      if (!expectation.passed) {
        return {
          name: spec.name,
          passed: false,
          durationMs: Date.now() - startedAt,
          stateDir,
          steps,
        };
      }
    }
    return {
      name: spec.name,
      passed: true,
      durationMs: Date.now() - startedAt,
      stateDir,
      steps,
    };
  } finally {
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
  }
}
