import type { AgentActionLog, ChannelMessageLog, CronRunLog } from "../types.js";
import type { LogSink } from "./sink.js";

export class ConvexLogSink implements LogSink {
  async logAgentAction(_entry: AgentActionLog): Promise<void> {
    // SLC-1: placeholder. SLC-2 pushes to Convex HTTP endpoint.
  }

  async logCronRun(_entry: CronRunLog): Promise<void> {
    // SLC-1: placeholder.
  }

  async logChannelMessage(_entry: ChannelMessageLog): Promise<void> {
    // SLC-1: placeholder.
  }
}
