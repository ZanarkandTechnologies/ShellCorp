import { exec } from "node:child_process";
import { promisify } from "node:util";

import { isBashCommandAllowed } from "../security/policy.js";

const execAsync = promisify(exec);

export async function runBash(command: string, cwd?: string, extraEnv?: Record<string, string>): Promise<string> {
  if (!isBashCommandAllowed(command)) {
    throw new Error("Command blocked by security policy.");
  }
  const { stdout, stderr } = await execAsync(command, {
    cwd,
    env: { ...process.env, ...(extraEnv ?? {}) },
    maxBuffer: 1024 * 1024,
    timeout: 120_000,
  });
  return [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
}

export async function runOpencode(repoDir: string, instruction: string): Promise<string> {
  const escaped = instruction.replaceAll('"', '\\"');
  return runBash(`cd "${repoDir}" && opencode "${escaped}"`);
}

export async function runOagi(instruction: string): Promise<string> {
  const escaped = instruction.replaceAll('"', '\\"');
  return runBash(`oagi "${escaped}"`);
}
