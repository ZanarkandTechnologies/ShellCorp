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
    private readonly sessionKey = "brain:main",
  ) {}

  start(): void {
    this.job?.stop();
    this.job = new Cron(`*/${this.intervalMinutes} * * * *`, async () => {
      const promptPath = path.join(this.workspaceDir, "HEARTBEAT.md");
      const prompt = await this.safeRead(promptPath);
      if (!prompt.trim()) return;

      const response = await this.brain.handleMessage(this.sessionKey, prompt);
      if (response.trim() !== "HEARTBEAT_OK") {
        await this.logSink.logCronRun({
          ts: Date.now(),
          jobId: "heartbeat",
          status: "ok",
          detail: response.slice(0, 300),
        });
      }
    });
  }

  stop(): void {
    this.job?.stop();
    this.job = null;
  }

  private async safeRead(filePath: string): Promise<string> {
    try {
      return await readFile(filePath, "utf8");
    } catch {
      return "";
    }
  }
}
