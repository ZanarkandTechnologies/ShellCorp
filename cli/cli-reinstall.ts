#!/usr/bin/env node

/**
 * CLI REINSTALL
 * =============
 * Purpose
 * - Provide a cross-platform entrypoint for refreshing the global ShellCorp CLI alias.
 *
 * KEY CONCEPTS:
 * - Reuses the shared reinstall helper so npm scripts, onboarding, and tests stay aligned.
 * - Prints each command step and exits non-zero on failure.
 *
 * USAGE:
 * - npm run cli:reinstall
 * - tsx cli/cli-reinstall.ts --repo-root /path/to/ShellCorp
 *
 * MEMORY REFERENCES:
 * - MEM-0178
 * - MEM-0181
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { type CliReinstallResult, reinstallShellcorpCli } from "./cli-install.js";

type ReinstallRunner = (params: { repoRoot: string }) => Promise<CliReinstallResult>;

let reinstallRunner: ReinstallRunner = reinstallShellcorpCli;

export function setCliReinstallRunnerForTests(runner: ReinstallRunner | null): void {
  reinstallRunner = runner ?? reinstallShellcorpCli;
}

function resolveDefaultRepoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function readRepoRoot(argv: readonly string[]): string {
  const index = argv.indexOf("--repo-root");
  if (index < 0) return resolveDefaultRepoRoot();
  const value = argv[index + 1]?.trim();
  return value ? path.resolve(value) : resolveDefaultRepoRoot();
}

export async function runCliReinstall(
  argv: readonly string[],
  io: {
    log: (message: string) => void;
    error: (message: string) => void;
  } = { log: console.log, error: console.error },
): Promise<number> {
  const repoRoot = readRepoRoot(argv);
  io.log(`Refreshing ShellCorp CLI from ${repoRoot}`);
  const result = await reinstallRunner({ repoRoot });

  for (const step of result.steps) {
    const status = step.ok ? "ok" : "failed";
    io.log(`${status}: ${step.command}${step.note !== "ok" ? ` (${step.note})` : ""}`);
  }

  if (!result.ok) {
    io.error(result.note);
    return 1;
  }

  io.log(result.note);
  return 0;
}

async function main(): Promise<void> {
  process.exitCode = await runCliReinstall(process.argv.slice(2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main();
}
