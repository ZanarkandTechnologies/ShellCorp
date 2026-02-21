import path from "node:path";

import { loadConfig } from "../../config/loader.js";
import { CronManager, type CronJobDefinition } from "../../scheduler/cron.js";
import { FileLogSink } from "../../logging/file-sink.js";
import type { BrainRuntime } from "../../agent/runner.js";

const noopBrain: BrainRuntime = {
  async handleMessage() {
    return "noop";
  },
  async spawnRoleSession() {
    return;
  },
  listSessions() {
    return [];
  },
};

function managerFromConfig(dataDir: string): CronManager {
  return new CronManager(noopBrain, new FileLogSink(), path.join(dataDir, "cron-jobs.json"));
}

export async function cronList(configPath?: string): Promise<void> {
  const config = await loadConfig(configPath);
  const manager = managerFromConfig(config.dataDir);
  await manager.loadAndStart();
  console.log(manager.listActiveJobIds().join("\n") || "No active jobs.");
}

export async function cronAdd(
  id: string,
  schedule: string,
  prompt: string,
  sessionKey: string,
  configPath?: string,
): Promise<void> {
  const config = await loadConfig(configPath);
  const manager = managerFromConfig(config.dataDir);
  const definition: CronJobDefinition = { id, schedule, prompt, sessionKey, enabled: true };
  await manager.addJob(definition);
  console.log(`Added cron job: ${id}`);
}

export async function cronRemove(id: string, configPath?: string): Promise<void> {
  const config = await loadConfig(configPath);
  const manager = managerFromConfig(config.dataDir);
  await manager.removeJob(id);
  console.log(`Removed cron job: ${id}`);
}
