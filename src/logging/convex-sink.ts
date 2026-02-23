import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import type { AgentActionLog, ChannelMessageLog, CronRunLog } from "../types.js";
import type { LogSink } from "./sink.js";

export class ConvexLogSink implements LogSink {
  private readonly client: ConvexHttpClient;

  constructor(deploymentUrl: string, authToken?: string) {
    this.client = new ConvexHttpClient(deploymentUrl);
    if (authToken) this.client.setAuth(authToken);
  }

  async logAgentAction(entry: AgentActionLog): Promise<void> {
    await this.client.mutation(anyApi.logs.ingest, {
      ts: entry.ts,
      kind: "agent",
      payload: entry,
    });
  }

  async logCronRun(entry: CronRunLog): Promise<void> {
    await this.client.mutation(anyApi.logs.ingest, {
      ts: entry.ts,
      kind: "cron",
      payload: entry,
    });
  }

  async logChannelMessage(entry: ChannelMessageLog): Promise<void> {
    await this.client.mutation(anyApi.logs.ingest, {
      ts: entry.ts,
      kind: "channel",
      payload: entry,
    });
  }
}
