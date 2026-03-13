/**
 * UI COMMANDS
 * ===========
 * Purpose
 * - Provide a ShellCorp-native alias for starting the UI dev server.
 *
 * KEY CONCEPTS:
 * - ShellCorp CLI stays the primary operator entrypoint.
 * - The UI command shells out to the repo-local `npm run ui`.
 *
 * USAGE:
 * - shellcorp ui
 *
 * MEMORY REFERENCES:
 * - MEM-0162
 * - MEM-0164
 */

import { spawn } from "node:child_process";
import type { Command } from "commander";
import { cliBlue, cliDim, cliSection } from "./cli-utils.js";

function npmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

type StartUiDevServerOptions = {
  cwd?: string;
  propagateSignal?: boolean;
};

export async function startUiDevServer(options: StartUiDevServerOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const propagateSignal = options.propagateSignal !== false;

  // On Windows, spawning .cmd files (e.g. npm.cmd) without a shell throws EINVAL (Node CVE-2024-27980).
  // Use a single command string with shell: true so the shell runs npm.
  const useShell = process.platform === "win32";
  const baseOpts = { cwd, stdio: "inherit" as const, env: process.env };

  await new Promise<void>((resolve, reject) => {
    const child = useShell
      ? spawn("npm run ui", [], { ...baseOpts, shell: true })
      : spawn(npmCommand(), ["run", "ui"], baseOpts);

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        if (propagateSignal) {
          process.kill(process.pid, signal);
          return;
        }
        resolve();
        return;
      }
      if ((code ?? 1) !== 0) {
        reject(new Error(`ui_command_failed:${code ?? 1}`));
        return;
      }
      resolve();
    });
  });
}

export function registerUiCommands(program: Command): void {
  program
    .command("ui")
    .description("Start the ShellCorp UI dev server")
    .action(async () => {
      console.log(cliSection("ShellCorp UI"));
      console.log(cliDim("Starting the Vite dev server with `npm run ui`."));
      console.log(cliBlue("Stop it with Ctrl+C. You can rerun this command any time."));
      console.log("");
      await startUiDevServer();
    });
}
