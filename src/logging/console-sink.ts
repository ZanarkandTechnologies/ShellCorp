import type { LogSink } from "./sink.js";
import type { AgentActionLog, ChannelMessageLog, CronRunLog } from "../types.js";

export class ConsoleLogSink implements LogSink {
  async logAgentAction(entry: AgentActionLog): Promise<void> {
    console.log("[agent]", JSON.stringify(entry));
  }

  async logCronRun(entry: CronRunLog): Promise<void> {
    console.log("[cron]", JSON.stringify(entry));
  }

  async logChannelMessage(entry: ChannelMessageLog): Promise<void> {
    console.log("[channel]", JSON.stringify(entry));
  }
}
