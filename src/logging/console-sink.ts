import type { LogSink } from "./sink.js";
import type { AgentActionLog, ChannelMessageLog, CronRunLog } from "../types.js";
import { formatLogLine, sanitizeInline } from "./pretty.js";

export class ConsoleLogSink implements LogSink {
  async logAgentAction(entry: AgentActionLog): Promise<void> {
    console.log(
      formatLogLine("agent", entry.action, {
        ts: entry.ts,
        session: entry.sessionKey,
        correlationId: entry.correlationId,
        message: sanitizeInline(entry.message),
        meta: entry.meta ? sanitizeInline(entry.meta) : undefined,
      }),
    );
  }

  async logCronRun(entry: CronRunLog): Promise<void> {
    console.log(
      formatLogLine("cron", "run", {
        ts: entry.ts,
        jobId: entry.jobId,
        correlationId: entry.correlationId,
        status: entry.status,
        detail: sanitizeInline(entry.detail),
      }),
    );
  }

  async logChannelMessage(entry: ChannelMessageLog): Promise<void> {
    console.log(
      formatLogLine("channel", entry.direction, {
        ts: entry.ts,
        channel: entry.channelId,
        source: entry.sourceId,
        sender: entry.senderId,
        correlationId: entry.correlationId,
        content: sanitizeInline(entry.content),
      }),
    );
  }
}
