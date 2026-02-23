import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Cron } from "croner";

import type { BrainRuntime } from "../agent/runner.js";
import type { LogSink } from "../logging/sink.js";
import type { CronRunLog, ObservationTrustClass } from "../types.js";

export interface CronJobDefinition {
  id: string;
  schedule: string;
  prompt: string;
  sessionKey: string;
  enabled: boolean;
  observation?: {
    source: string;
    sourceRef: string;
    projectTags?: string[];
    roleTags?: string[];
    trustClass?: ObservationTrustClass;
    confidence?: number;
  };
}

export class CronManager {
  private readonly jobs = new Map<string, Cron>();

  constructor(
    private readonly brain: BrainRuntime,
    private readonly logSink: LogSink,
    private readonly storePath = path.join(os.homedir(), ".fahrenheit", "cron-jobs.json"),
    private readonly runsPath = path.join(os.homedir(), ".fahrenheit", "cron-runs.jsonl"),
    private readonly onRunComplete?: (run: CronRunLog & { elapsedMs?: number }, def: CronJobDefinition) => Promise<void>,
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

  async listDefinitions(): Promise<CronJobDefinition[]> {
    return this.loadDefinitions();
  }

  async listRuns(limit = 50): Promise<Array<CronRunLog & { elapsedMs?: number }>> {
    if (!existsSync(this.runsPath)) return [];
    const raw = await readFile(this.runsPath, "utf8");
    const parsed = raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as CronRunLog & { elapsedMs?: number };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is CronRunLog & { elapsedMs?: number } => Boolean(entry));
    const safeLimit = Math.max(1, Math.min(limit, 200));
    return parsed.slice(Math.max(0, parsed.length - safeLimit)).reverse();
  }

  async addJob(def: CronJobDefinition): Promise<void> {
    const defs = await this.loadDefinitions();
    const filtered = defs.filter((d) => d.id !== def.id);
    filtered.push(def);
    await this.saveDefinitions(filtered);
    if (def.enabled) {
      this.startJob(def);
      return;
    }
    const running = this.jobs.get(def.id);
    running?.stop();
    this.jobs.delete(def.id);
  }

  async updateJob(
    id: string,
    changes: Partial<Pick<CronJobDefinition, "schedule" | "prompt" | "sessionKey" | "enabled">>,
  ): Promise<CronJobDefinition> {
    const defs = await this.loadDefinitions();
    const existing = defs.find((d) => d.id === id);
    if (!existing) throw new Error("cron_job_not_found");
    const updated: CronJobDefinition = {
      ...existing,
      ...changes,
      id: existing.id,
    };
    const nextDefs = defs.map((d) => (d.id === id ? updated : d));
    await this.saveDefinitions(nextDefs);
    if (updated.enabled) {
      this.startJob(updated);
    } else {
      const running = this.jobs.get(id);
      running?.stop();
      this.jobs.delete(id);
    }
    return updated;
  }

  async setEnabled(id: string, enabled: boolean): Promise<CronJobDefinition> {
    return this.updateJob(id, { enabled });
  }

  async removeJob(id: string): Promise<void> {
    const defs = await this.loadDefinitions();
    await this.saveDefinitions(defs.filter((d) => d.id !== id));
    const running = this.jobs.get(id);
    running?.stop();
    this.jobs.delete(id);
  }

  shutdown(): void {
    for (const job of this.jobs.values()) {
      job.stop();
    }
    this.jobs.clear();
  }

  private startJob(def: CronJobDefinition): void {
    const running = this.jobs.get(def.id);
    running?.stop();

    const job = new Cron(def.schedule, async () => {
      const startedAt = Date.now();
      const correlationId = `cron:${def.id}:${startedAt}`;
      try {
        await this.brain.handleMessage(def.sessionKey, def.prompt, { correlationId });
        const run: CronRunLog & { elapsedMs: number } = {
          ts: Date.now(),
          jobId: def.id,
          correlationId,
          status: "ok",
          detail: "Job executed",
          elapsedMs: Date.now() - startedAt,
        };
        await this.logSink.logCronRun(run);
        await this.appendRun(run);
        if (this.onRunComplete) await this.onRunComplete(run, def);
      } catch (error) {
        const run: CronRunLog & { elapsedMs: number } = {
          ts: Date.now(),
          jobId: def.id,
          correlationId,
          status: "error",
          detail: error instanceof Error ? error.message : "Unknown error",
          elapsedMs: Date.now() - startedAt,
        };
        await this.logSink.logCronRun(run);
        await this.appendRun(run);
        if (this.onRunComplete) await this.onRunComplete(run, def);
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

  private async appendRun(run: CronRunLog & { elapsedMs?: number }): Promise<void> {
    await mkdir(path.dirname(this.runsPath), { recursive: true });
    await appendFile(this.runsPath, `${JSON.stringify(run)}\n`, "utf8");
  }
}
