import type { AgentActionLog, ChannelMessageLog, CronRunLog } from "../types.js";

export interface LogSink {
  logAgentAction(entry: AgentActionLog): Promise<void>;
  logCronRun(entry: CronRunLog): Promise<void>;
  logChannelMessage(entry: ChannelMessageLog): Promise<void>;
}
