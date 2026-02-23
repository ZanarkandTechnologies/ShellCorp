import { readFile } from "node:fs/promises";
import path from "node:path";
import { Cron } from "croner";

import type { BrainRuntime } from "../agent/runner.js";
import type { LogSink } from "../logging/sink.js";

export class HeartbeatRunner {
  private job: Cron | null = null;

  constructor(
    private readonly brain: BrainRuntime,
    private readonly logSink: LogSink,
    private readonly workspaceDir: string,
    private readonly intervalMinutes: number,
    private readonly promptPath: string,
    private readonly sessionKey = "brain:main",
    private readonly onTick?: () => Promise<void>,
  ) {}

  start(): void {
    this.job?.stop();
    this.job = new Cron(`*/${this.intervalMinutes} * * * *`, async () => this.runOnce());
  }

  stop(): void {
    this.job?.stop();
    this.job = null;
  }

  async runOnce(): Promise<void> {
    if (this.onTick) {
      await this.onTick();
    }
    const promptPath = path.join(this.workspaceDir, this.promptPath);
    const prompt = await this.safeRead(promptPath);
    if (!prompt.trim()) return;
    const ts = Date.now();
    const correlationId = `heartbeat:${ts}`;
    const response = await this.brain.handleMessage(this.sessionKey, prompt, { correlationId });
    if (response.trim() !== "HEARTBEAT_OK") {
      await this.logSink.logCronRun({
        ts,
        jobId: "heartbeat",
        correlationId,
        status: "ok",
        detail: response.slice(0, 300),
      });
    }
  }

  private async safeRead(filePath: string): Promise<string> {
    try {
      return await readFile(filePath, "utf8");
    } catch {
      return "";
    }
  }
}
