/**
 * CLI TUI Command
 * ===============
 * Interactive terminal entrypoint for personal PI sessions.
 *
 * KEY CONCEPTS:
 * - Reuses PiBrainRuntime so tool/skill behavior matches gateway sessions.
 * - Uses personal-compatible session key format for CLI conversations.
 * - Supports lightweight slash commands for session switching.
 *
 * USAGE:
 * - `fahrenheit tui`
 * - `fahrenheit tui --session group:personal:cli:dm:alice`
 *
 * MEMORY REFERENCES:
 * - MEM-0007
 */
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { loadConfig } from "../../config/loader.js";
import { FileLogSink } from "../../logging/file-sink.js";
import { PiBrainRuntime } from "../../agent/runner.js";
import { buildPersonalCliSessionKey } from "../../gateway/routing.js";

function resolveDefaultCliSessionKey(): string {
  const username = os.userInfo().username || "local";
  return buildPersonalCliSessionKey(username);
}

function parseSlashSession(inputText: string): string | null {
  const trimmed = inputText.trim();
  if (!trimmed.startsWith("/session ")) return null;
  const next = trimmed.slice("/session ".length).trim();
  return next || null;
}

export async function tuiCommand(configPath?: string, sessionOverride?: string): Promise<void> {
  const config = await loadConfig(configPath);
  const runtime = new PiBrainRuntime({
    dataDir: config.runtime.dataDir,
    workspaceDir: path.resolve(config.runtime.workspaceDir),
    logSink: new FileLogSink(),
    ai: config.runtime.ai,
    agent: config.runtime.agent,
  });

  let sessionKey = sessionOverride || config.runtime.agent.personalSessionKey || resolveDefaultCliSessionKey();
  const rl = readline.createInterface({ input, output });
  console.log("Fahrenheit TUI");
  console.log(`Session: ${sessionKey}`);
  console.log('Commands: "/exit" to quit, "/session <key>" to switch session.\n');

  try {
    while (true) {
      const userInput = (await rl.question("You> ")).trim();
      if (!userInput) continue;
      if (userInput === "/exit") break;
      const switchTo = parseSlashSession(userInput);
      if (switchTo) {
        sessionKey = switchTo;
        console.log(`Switched session: ${sessionKey}`);
        continue;
      }
      const response = await runtime.handleMessage(sessionKey, userInput);
      console.log(`Blitz> ${response}\n`);
    }
  } finally {
    rl.close();
  }
}
