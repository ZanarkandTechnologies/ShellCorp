/**
 * Gateway event/message persistence adapters.
 *
 * Responsibility:
 * - Define the storage contract used by the gateway (`MessageStore`).
 * - Provide pluggable sink implementations (memory, file, convex).
 */
import path from "node:path";
import { mkdir, appendFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import type { GatewayMessage } from "../types.js";
import type { FahrenheitConfig } from "../config/schema.js";

export interface MessageStore {
  ingest(message: GatewayMessage): Promise<void>;
  listRecent(limit: number): Promise<GatewayMessage[]>;
  listByChannel(channelId: string, limit: number): Promise<GatewayMessage[]>;
}

export class InMemoryMessageStore implements MessageStore {
  private readonly entries: GatewayMessage[] = [];

  constructor(private readonly maxEntries = 10000) {}

  async ingest(message: GatewayMessage): Promise<void> {
    this.entries.push(message);
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
  }

  async listRecent(limit: number): Promise<GatewayMessage[]> {
    const safeLimit = Math.max(1, Math.min(limit, 500));
    return [...this.entries].sort((a, b) => b.timestamp - a.timestamp).slice(0, safeLimit);
  }

  async listByChannel(channelId: string, limit: number): Promise<GatewayMessage[]> {
    const safeLimit = Math.max(1, Math.min(limit, 500));
    return this.entries
      .filter((entry) => entry.channelId === channelId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, safeLimit);
  }
}

export class JsonlMessageStore implements MessageStore {
  constructor(private readonly filePath: string) {}

  async ingest(message: GatewayMessage): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${JSON.stringify(message)}\n`, "utf8");
  }

  async listRecent(limit: number): Promise<GatewayMessage[]> {
    const rows = await this.readAll();
    const safeLimit = Math.max(1, Math.min(limit, 500));
    return rows.sort((a, b) => b.timestamp - a.timestamp).slice(0, safeLimit);
  }

  async listByChannel(channelId: string, limit: number): Promise<GatewayMessage[]> {
    const rows = await this.readAll();
    const safeLimit = Math.max(1, Math.min(limit, 500));
    return rows
      .filter((entry) => entry.channelId === channelId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, safeLimit);
  }

  private async readAll(): Promise<GatewayMessage[]> {
    if (!existsSync(this.filePath)) return [];
    const content = await readFile(this.filePath, "utf8");
    if (!content.trim()) return [];

    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as GatewayMessage;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is GatewayMessage => Boolean(entry));
  }
}

export class ConvexMessageStore implements MessageStore {
  private readonly client: ConvexHttpClient;

  constructor(deploymentUrl: string, authToken?: string) {
    this.client = new ConvexHttpClient(deploymentUrl);
    // Gateway writes are server-to-server; optional token supports locked deployments.
    if (authToken) this.client.setAuth(authToken);
  }

  async ingest(message: GatewayMessage): Promise<void> {
    await this.client.mutation(anyApi.messages.ingest, message);
  }

  async listRecent(limit: number): Promise<GatewayMessage[]> {
    const rows = await this.client.query(anyApi.messages.listRecent, { limit });
    return rows as GatewayMessage[];
  }

  async listByChannel(channelId: string, limit: number): Promise<GatewayMessage[]> {
    const rows = await this.client.query(anyApi.messages.listByChannel, { channelId, limit });
    return rows as GatewayMessage[];
  }
}

export function createMessageStore(config: FahrenheitConfig): MessageStore {
  const sinkType = config.gateway.sink.type;
  const sinkConfig = config.gateway.sink;

  if (sinkType === "convex") {
    const deploymentUrl = sinkConfig.convex?.deploymentUrl;
    if (!deploymentUrl) {
      throw new Error("gateway.sink.type=convex requires gateway.sink.convex.deploymentUrl");
    }
    const authToken = sinkConfig.convex?.authToken;
    return new ConvexMessageStore(deploymentUrl, authToken);
  }
  if (sinkType === "file") {
    const filePath = sinkConfig.filePath ?? path.join(config.runtime.dataDir, "events", "messages.jsonl");
    return new JsonlMessageStore(filePath);
  }
  return new InMemoryMessageStore(sinkConfig.memoryMaxEntries);
}
