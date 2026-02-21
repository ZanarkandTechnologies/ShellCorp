import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Cron } from "croner";

import type { BrainRuntime } from "../agent/runner.js";
import type { LogSink } from "../logging/sink.js";

export interface CronJobDefinition {
  id: string;
  schedule: string;
  prompt: string;
  sessionKey: string;
  enabled: boolean;
}

export class CronManager {
  private readonly jobs = new Map<string, Cron>();

  constructor(
    private readonly brain: BrainRuntime,
    private readonly logSink: LogSink,
    private readonly storePath = path.join(os.homedir(), ".bahamut", "cron-jobs.json"),
  ) {}

  async loadAndStart(): Promise<void> {
    const defs = await this.loadDefinitions();
    for (const def of defs) {
      if (def.enabled) this.startJob(def);
    }
  }

  listActiveJobIds(): string[] {
    return [...this.jobs.keys()];
  }

  async addJob(def: CronJobDefinition): Promise<void> {
    const defs = await this.loadDefinitions();
    const filtered = defs.filter((d) => d.id !== def.id);
    filtered.push(def);
    await this.saveDefinitions(filtered);
    this.startJob(def);
  }

  async removeJob(id: string): Promise<void> {
    const defs = await this.loadDefinitions();
    await this.saveDefinitions(defs.filter((d) => d.id !== id));
    const running = this.jobs.get(id);
    running?.stop();
    this.jobs.delete(id);
  }

  private startJob(def: CronJobDefinition): void {
    const running = this.jobs.get(def.id);
    running?.stop();

    const job = new Cron(def.schedule, async () => {
      try {
        await this.brain.handleMessage(def.sessionKey, def.prompt);
        await this.logSink.logCronRun({
          ts: Date.now(),
          jobId: def.id,
          status: "ok",
          detail: "Job executed",
        });
      } catch (error) {
        await this.logSink.logCronRun({
          ts: Date.now(),
          jobId: def.id,
          status: "error",
          detail: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
    this.jobs.set(def.id, job);
  }

  private async loadDefinitions(): Promise<CronJobDefinition[]> {
    if (!existsSync(this.storePath)) {
      await mkdir(path.dirname(this.storePath), { recursive: true });
      await writeFile(this.storePath, "[]", "utf8");
    }
    const raw = await readFile(this.storePath, "utf8");
    const parsed = JSON.parse(raw) as CronJobDefinition[];
    return Array.isArray(parsed) ? parsed : [];
  }

  private async saveDefinitions(defs: CronJobDefinition[]): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(this.storePath, JSON.stringify(defs, null, 2), "utf8");
  }
}
