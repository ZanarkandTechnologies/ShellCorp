import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import type { LogSink } from "./sink.js";
import type { AgentActionLog, ChannelMessageLog, CronRunLog } from "../types.js";

function datePart(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function resolveAuditDir(baseDir?: string): string {
  if (baseDir) return baseDir;
  return path.join(os.homedir(), ".fahrenheit", "audit");
}

export class FileLogSink implements LogSink {
  constructor(private readonly auditDir = resolveAuditDir()) {}

  private async appendLine(entry: unknown, ts: number): Promise<void> {
    await mkdir(this.auditDir, { recursive: true });
    const filePath = path.join(this.auditDir, `${datePart(ts)}.jsonl`);
    await appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  }

  async logAgentAction(entry: AgentActionLog): Promise<void> {
    await this.appendLine({ kind: "agent", ...entry }, entry.ts);
  }

  async logCronRun(entry: CronRunLog): Promise<void> {
    await this.appendLine({ kind: "cron", ...entry }, entry.ts);
  }

  async logChannelMessage(entry: ChannelMessageLog): Promise<void> {
    await this.appendLine({ kind: "channel", ...entry }, entry.ts);
  }
}
