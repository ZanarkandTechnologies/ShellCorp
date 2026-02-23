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
  const manager = managerFromConfig(config.runtime.dataDir);
  await manager.loadAndStart();
  const defs = await manager.listDefinitions();
  if (defs.length === 0) {
    console.log("No cron jobs configured.");
    return;
  }
  const active = new Set(manager.listActiveJobIds());
  for (const def of defs) {
    const status = active.has(def.id) ? "active" : "inactive";
    console.log(`${def.id}\t${def.schedule}\t${def.sessionKey}\t${status}`);
  }
}

export async function cronAdd(
  id: string,
  schedule: string,
  prompt: string,
  sessionKey: string,
  configPath?: string,
): Promise<void> {
  const config = await loadConfig(configPath);
  const manager = managerFromConfig(config.runtime.dataDir);
  const definition: CronJobDefinition = { id, schedule, prompt, sessionKey, enabled: true };
  await manager.addJob(definition);
  console.log(`Added cron job: ${id}`);
}

export async function cronRemove(id: string, configPath?: string): Promise<void> {
  const config = await loadConfig(configPath);
  const manager = managerFromConfig(config.runtime.dataDir);
  await manager.removeJob(id);
  console.log(`Removed cron job: ${id}`);
}

export async function cronUpdate(
  id: string,
  changes: Partial<Pick<CronJobDefinition, "schedule" | "prompt" | "sessionKey">>,
  configPath?: string,
): Promise<void> {
  const config = await loadConfig(configPath);
  const manager = managerFromConfig(config.runtime.dataDir);
  const updated = await manager.updateJob(id, changes);
  console.log(`Updated cron job: ${updated.id}`);
}

export async function cronEnable(id: string, enabled: boolean, configPath?: string): Promise<void> {
  const config = await loadConfig(configPath);
  const manager = managerFromConfig(config.runtime.dataDir);
  await manager.setEnabled(id, enabled);
  console.log(`${enabled ? "Enabled" : "Disabled"} cron job: ${id}`);
}
