/**
 * CLI INSTALL
 * ===========
 * Purpose
 * - Centralize ShellCorp CLI install and reinstall command flows.
 *
 * KEY CONCEPTS:
 * - The global `shellcorp` alias is managed through `npm link` at the repo root.
 * - Reinstall refreshes dependencies, rebuilds the CLI bundle, and relinks the alias.
 *
 * USAGE:
 * - installShellcorpCli({ repoRoot, requested: true })
 * - reinstallShellcorpCli({ repoRoot })
 *
 * MEMORY REFERENCES:
 * - MEM-0178
 * - MEM-0181
 */

import { execFile as execFileCallback } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";

export type CliInstallResult = {
  attempted: boolean;
  ok: boolean;
  status: "installed" | "skipped" | "failed";
  command: string;
  note: string;
};

export type CliReinstallStep = {
  command: string;
  ok: boolean;
  note: string;
};

export type CliReinstallResult = {
  attempted: boolean;
  ok: boolean;
  status: "reinstalled" | "failed";
  note: string;
  steps: CliReinstallStep[];
};

type CliExecFileRunner = (
  file: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
  },
) => Promise<{ stdout: string | Buffer; stderr: string | Buffer }>;

const defaultExecFile = promisify(execFileCallback);

let execFileRunner: CliExecFileRunner = async (file, args, options) =>
  defaultExecFile(file, args, options);

export function setCliInstallExecFileRunnerForTests(runner: CliExecFileRunner | null): void {
  execFileRunner = runner ?? (async (file, args, options) => defaultExecFile(file, args, options));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function extractErrorDetail(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "unknown_error";
}

async function ensureRepoPackageJson(repoRoot: string): Promise<string | null> {
  const packageJsonPath = `${repoRoot}/package.json`;
  return (await fileExists(packageJsonPath)) ? packageJsonPath : null;
}

export async function installShellcorpCli(params: {
  repoRoot: string;
  requested: boolean;
}): Promise<CliInstallResult> {
  const command = "npm link";
  if (!params.requested) {
    return {
      attempted: false,
      ok: false,
      status: "skipped",
      command,
      note: "CLI install skipped. Run `npm link` later if you want the global `shellcorp` alias.",
    };
  }

  if (!(await ensureRepoPackageJson(params.repoRoot))) {
    return {
      attempted: false,
      ok: false,
      status: "skipped",
      command,
      note: "CLI install skipped because the repo root does not contain a package.json for `npm link`.",
    };
  }

  try {
    await execFileRunner("npm", ["link"], {
      cwd: params.repoRoot,
      env: process.env,
    });
    return {
      attempted: true,
      ok: true,
      status: "installed",
      command,
      note: "Global `shellcorp` alias is installed for this repo.",
    };
  } catch (error) {
    const detail = extractErrorDetail(error);
    return {
      attempted: true,
      ok: false,
      status: "failed",
      command,
      note: `CLI install failed (${detail}). Run \`npm link\` manually from the repo root if you want the global alias.`,
    };
  }
}

async function runStep(repoRoot: string, args: string[]): Promise<CliReinstallStep> {
  const command = `npm ${args.join(" ")}`;
  try {
    await execFileRunner("npm", args, {
      cwd: repoRoot,
      env: process.env,
    });
    return { command, ok: true, note: "ok" };
  } catch (error) {
    const detail = extractErrorDetail(error);
    return { command, ok: false, note: detail };
  }
}

export async function reinstallShellcorpCli(params: {
  repoRoot: string;
}): Promise<CliReinstallResult> {
  if (!(await ensureRepoPackageJson(params.repoRoot))) {
    return {
      attempted: false,
      ok: false,
      status: "failed",
      note: "CLI reinstall failed because the repo root does not contain a package.json.",
      steps: [],
    };
  }

  const steps: CliReinstallStep[] = [];

  for (const args of [["install"], ["run", "cli:bundle"]]) {
    const step = await runStep(params.repoRoot, args);
    steps.push(step);
    if (!step.ok) {
      return {
        attempted: true,
        ok: false,
        status: "failed",
        note: `CLI reinstall failed while running \`${step.command}\` (${step.note}).`,
        steps,
      };
    }
  }

  const unlinkStep = await runStep(params.repoRoot, ["unlink", "-g", "shellcorp"]);
  steps.push(
    unlinkStep.ok
      ? unlinkStep
      : {
          ...unlinkStep,
          ok: true,
          note: `ignored: ${unlinkStep.note}`,
        },
  );

  const linkStep = await runStep(params.repoRoot, ["link"]);
  steps.push(linkStep);
  if (!linkStep.ok) {
    return {
      attempted: true,
      ok: false,
      status: "failed",
      note: `CLI reinstall failed while running \`${linkStep.command}\` (${linkStep.note}).`,
      steps,
    };
  }

  return {
    attempted: true,
    ok: true,
    status: "reinstalled",
    note: "Global `shellcorp` alias was refreshed against the current repo checkout.",
    steps,
  };
}
