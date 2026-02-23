import type { LogSink } from "./sink.js";
import type { AgentActionLog, ChannelMessageLog, CronRunLog } from "../types.js";
import { redactUnknown } from "../security/redact.js";

export class RedactingLogSink implements LogSink {
  constructor(
    private readonly inner: LogSink,
    private readonly sensitiveValues: string[],
  ) {}

  async logAgentAction(entry: AgentActionLog): Promise<void> {
    await this.inner.logAgentAction(redactUnknown(entry, this.sensitiveValues) as AgentActionLog);
  }

  async logCronRun(entry: CronRunLog): Promise<void> {
    await this.inner.logCronRun(redactUnknown(entry, this.sensitiveValues) as CronRunLog);
  }

  async logChannelMessage(entry: ChannelMessageLog): Promise<void> {
    await this.inner.logChannelMessage(redactUnknown(entry, this.sensitiveValues) as ChannelMessageLog);
  }
}
