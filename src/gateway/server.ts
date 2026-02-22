/**
 * Gateway server orchestration.
 *
 * Responsibility:
 * - Bootstrap runtime dependencies (config, log sink, store, channels, scheduler).
 * - Expose HTTP ingestion/query API.
 * - Normalize all inbound traffic (channel adapters + HTTP) through one processing path.
 * - Keep gateway as source-of-truth entrypoint for conversational and observational data.
 */
import path from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";

import { loadConfig } from "../config/loader.js";
import type { FahrenheitConfig } from "../config/schema.js";
import { FileLogSink } from "../logging/file-sink.js";
import { ConsoleLogSink } from "../logging/console-sink.js";
import { ConvexLogSink } from "../logging/convex-sink.js";
import type { LogSink } from "../logging/sink.js";
import { PiBrainRuntime, defaultDataDir } from "../agent/runner.js";
import { GatewayRouter } from "./router.js";
import { GatewayBus } from "./bus.js";
import { TelegramChannel } from "../channels/telegram.js";
import { DiscordChannel } from "../channels/discord.js";
import { SlackChannel } from "../channels/slack.js";
import { WhatsAppChannel } from "../channels/whatsapp.js";
import type { BaseChannel, ProviderSetupSpec, ProviderStatus } from "../channels/base.js";
import type { GatewayMessage, InboundEnvelope, OutboundEnvelope } from "../types.js";
import { CronManager } from "../scheduler/cron.js";
import { HeartbeatRunner } from "../scheduler/heartbeat.js";
import { defaultRoles } from "../agent/roles.js";
import { inboundToMessage, parseGatewayMessage } from "./schema.js";
import { ConvexMessageStore, type MessageStore } from "./message-store.js";

async function ensureWorkspaceTemplate(workspaceDir: string): Promise<void> {
  await mkdir(path.join(workspaceDir, "skills"), { recursive: true });
  const defaults: Record<string, string> = {
    "AGENTS.md": "Blitz brain session for Fahrenheit.",
    "SOUL.md": "Operate safely and decisively.",
    "TOOLS.md": "Use bash and file tools carefully.",
    "HEARTBEAT.md": "Review current workload and update memory. Return HEARTBEAT_OK when no action is needed.",
    "HISTORY.md": "",
    "MEMORY.md": "",
  };
  await Promise.all(
    Object.entries(defaults).map(([name, content]) =>
      writeFile(path.join(workspaceDir, name), content, { encoding: "utf8", flag: "a" }),
    ),
  );
}

function createLogSink(config: FahrenheitConfig): LogSink {
  if (config.logSink === "console") return new ConsoleLogSink();
  if (config.logSink === "convex") {
    if (!config.convex.enabled || !config.convex.deploymentUrl) {
      throw new Error("config.convex.deploymentUrl is required when logSink is convex");
    }
    return new ConvexLogSink(config.convex.deploymentUrl, config.convex.authToken);
  }
  return new FileLogSink();
}

export class GatewayServer {
  private channels: BaseChannel[] = [];
  private channelById = new Map<string, BaseChannel>();
  private cronManager: CronManager | null = null;
  private heartbeat: HeartbeatRunner | null = null;
  private runtime: PiBrainRuntime | null = null;
  private config: FahrenheitConfig | null = null;
  private router: GatewayRouter | null = null;
  private messageStore: MessageStore | null = null;
  private httpServer: ReturnType<typeof createServer> | null = null;
  private readonly bus = new GatewayBus();

  async start(configPath?: string): Promise<void> {
    this.config = await loadConfig(configPath);
    const workspaceDir = path.resolve(this.config.workspaceDir);
    await ensureWorkspaceTemplate(workspaceDir);
    const logSink = createLogSink(this.config);
    if (!this.config.convex.enabled || !this.config.convex.deploymentUrl) {
      throw new Error("config.convex.enabled=true and config.convex.deploymentUrl are required");
    }
    this.messageStore = new ConvexMessageStore(this.config.convex.deploymentUrl, this.config.convex.authToken);

    this.runtime = new PiBrainRuntime({
      dataDir: this.config.dataDir || defaultDataDir(),
      workspaceDir,
      logSink,
    });

    // Spawn default role sessions for baseline multi-session support.
    for (const role of defaultRoles) {
      if (role.id !== this.config.brainAgentId) {
        await this.runtime.spawnRoleSession(role.id, role.systemPrompt);
      }
    }

    this.router = new GatewayRouter(this.config, this.runtime, logSink, this.messageStore, this.bus);
    this.channels = this.buildChannels(this.config);
    this.channelById = new Map(this.channels.map((channel) => [channel.id, channel] as const));
    for (const channel of this.channels) {
      channel.setInboundHandler(async (envelope) => {
        // Built-in channels reuse the exact same ingestion path as external HTTP clients.
        const outbound = await this.processInboundMessage(inboundToMessage(envelope));
        if (outbound) {
          await channel.send(outbound);
        }
      });
      await channel.start();
    }
    await this.startHttpApi();

    this.cronManager = new CronManager(this.runtime, logSink);
    await this.cronManager.loadAndStart();

    this.heartbeat = new HeartbeatRunner(
      this.runtime,
      logSink,
      workspaceDir,
      this.config.heartbeat.intervalMinutes,
      "brain:main",
    );
    if (this.config.heartbeat.enabled) this.heartbeat.start();
  }

  async stop(): Promise<void> {
    this.heartbeat?.stop();
    await this.stopHttpApi();
    for (const channel of this.channels) {
      await channel.stop();
    }
    this.channels = [];
  }

  getStatus(): Record<string, unknown> {
    return {
      channels: this.channels.map((c) => c.id),
      sessions: this.runtime?.listSessions() ?? [],
      cronJobs: this.cronManager?.listActiveJobIds() ?? [],
      configLoaded: Boolean(this.config),
      gatewayApi: this.config ? `${this.config.gateway.host}:${this.config.gateway.port}` : null,
    };
  }

  private coreProviderIds(): string[] {
    return ["telegram", "discord", "slack", "whatsapp"];
  }

  private defaultSetupSpec(providerId: string): ProviderSetupSpec {
    if (providerId === "telegram") {
      return {
        providerId,
        title: "Telegram Bot",
        summary: "Connect Telegram bot token for native inbound/outbound messaging.",
        fields: [
          { key: "channels.telegram.enabled", label: "Enable channel", required: true, example: "true" },
          { key: "channels.telegram.botToken", label: "Bot token", required: true, secret: true },
        ],
        docsUrl: "https://core.telegram.org/bots/tutorial",
      };
    }
    if (providerId === "discord") {
      return {
        providerId,
        title: "Discord Bot",
        summary: "Connect Discord bot token and enable Message Content intent.",
        fields: [
          { key: "channels.discord.enabled", label: "Enable channel", required: true, example: "true" },
          { key: "channels.discord.token", label: "Bot token", required: true, secret: true },
        ],
        docsUrl: "https://discord.com/developers/applications",
      };
    }
    if (providerId === "slack") {
      return {
        providerId,
        title: "Slack App (Socket Mode)",
        summary: "Connect Slack xoxb and xapp tokens for realtime events.",
        fields: [
          { key: "channels.slack.enabled", label: "Enable channel", required: true, example: "true" },
          { key: "channels.slack.botToken", label: "Bot token", required: true, secret: true },
          { key: "channels.slack.appToken", label: "App token", required: true, secret: true },
        ],
        docsUrl: "https://api.slack.com/apps",
      };
    }
    return {
      providerId: "whatsapp",
      title: "WhatsApp (Bridge mode)",
      summary: "Bridge provider events into /ingest. Native QR pairing will be added later.",
      fields: [
        { key: "channels.whatsapp.enabled", label: "Enable channel", required: true, example: "true" },
        { key: "gateway.ingestToken", label: "Ingest token", required: false, secret: true },
      ],
      docsUrl: "https://deepwiki.com/openclaw/openclaw",
    };
  }

  private listProviders(): Array<{ setup: ProviderSetupSpec; status: ProviderStatus }> {
    if (!this.config) return [];

    const providers: Array<{ setup: ProviderSetupSpec; status: ProviderStatus }> = [];
    for (const providerId of this.coreProviderIds()) {
      const channel = this.channelById.get(providerId);
      if (channel) {
        providers.push({
          setup: channel.getSetupSpec(),
          status: channel.getStatus(),
        });
        continue;
      }

      const enabled = providerId in this.config.channels ? Boolean(this.config.channels[providerId as keyof typeof this.config.channels].enabled) : false;
      providers.push({
        setup: this.defaultSetupSpec(providerId),
        status: {
          providerId,
          enabled,
          connected: false,
          mode: providerId === "whatsapp" ? "bridge" : "native",
          lastError: enabled ? "provider_not_started_missing_credentials_or_not_implemented" : undefined,
        },
      });
    }

    for (const [providerId, provider] of Object.entries(this.config.providers)) {
      providers.push({
        setup: {
          providerId,
          title: `${providerId} (custom provider)`,
          summary: "Custom provider that pushes normalized events to /ingest.",
          fields: [{ key: `providers.${providerId}.enabled`, label: "Enable provider", required: true, example: "true" }],
        },
        status: {
          providerId,
          enabled: provider.enabled,
          connected: provider.enabled,
          mode: "bridge",
        },
      });
    }

    return providers;
  }

  private buildChannels(config: FahrenheitConfig): BaseChannel[] {
    const channels: BaseChannel[] = [];
    if (config.channels.telegram.enabled && config.channels.telegram.botToken) {
      channels.push(new TelegramChannel(config.channels.telegram.botToken));
    }
    if (config.channels.discord.enabled && config.channels.discord.token) {
      channels.push(new DiscordChannel(config.channels.discord.token));
    }
    if (config.channels.slack.enabled && config.channels.slack.botToken && config.channels.slack.appToken) {
      channels.push(new SlackChannel(config.channels.slack.botToken, config.channels.slack.appToken));
    }
    if (config.channels.whatsapp.enabled) {
      channels.push(new WhatsAppChannel(config.channels.whatsapp.authDir, config.channels.whatsapp.printQr));
    }
    return channels;
  }

  private async startHttpApi(): Promise<void> {
    if (!this.config) return;
    this.httpServer = createServer((req, res) => {
      void this.handleHttpRequest(req, res);
    });
    await new Promise<void>((resolve, reject) => {
      this.httpServer?.once("error", reject);
      this.httpServer?.listen(this.config?.gateway.port, this.config?.gateway.host, () => resolve());
    });
  }

  private async stopHttpApi(): Promise<void> {
    if (!this.httpServer) return;
    await new Promise<void>((resolve, reject) => {
      this.httpServer?.close((error) => (error ? reject(error) : resolve()));
    });
    this.httpServer = null;
  }

  private async readJsonBody(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    return raw ? JSON.parse(raw) : {};
  }

  private writeJson(res: ServerResponse, statusCode: number, data: unknown): void {
    res.statusCode = statusCode;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(data));
  }

  private unauthorized(res: ServerResponse): void {
    this.writeJson(res, 401, { error: "unauthorized" });
  }

  private tokenAllowed(req: IncomingMessage): boolean {
    const expected = this.config?.gateway.ingestToken;
    if (!expected) return true;
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) return false;
    return header.slice(7) === expected;
  }

  private async handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.config || !this.router || !this.messageStore) {
      this.writeJson(res, 503, { error: "gateway_not_ready" });
      return;
    }

    const parsedUrl = new URL(req.url ?? "/", `http://${this.config.gateway.host}:${this.config.gateway.port}`);
    if (req.method === "GET" && parsedUrl.pathname === "/status") {
      this.writeJson(res, 200, this.getStatus());
      return;
    }

    if (req.method === "GET" && parsedUrl.pathname === "/messages") {
      const limit = Number(parsedUrl.searchParams.get("limit") ?? "50");
      const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 200)) : 50;
      const channelId = parsedUrl.searchParams.get("channelId");
      const messages = channelId
        ? await this.messageStore.listByChannel(channelId, safeLimit)
        : await this.messageStore.listRecent(safeLimit);
      this.writeJson(res, 200, { messages });
      return;
    }

    if (req.method === "GET" && parsedUrl.pathname === "/providers") {
      this.writeJson(res, 200, { providers: this.listProviders() });
      return;
    }

    if (req.method === "GET" && parsedUrl.pathname.startsWith("/providers/")) {
      const segments = parsedUrl.pathname.split("/").filter(Boolean);
      const providerId = segments[1];
      const action = segments[2];
      const provider = this.listProviders().find((entry) => entry.status.providerId === providerId);
      if (!provider) {
        this.writeJson(res, 404, { error: "provider_not_found" });
        return;
      }
      if (action === "setup") {
        this.writeJson(res, 200, provider.setup);
        return;
      }
      if (action === "status") {
        this.writeJson(res, 200, provider.status);
        return;
      }
    }

    if (req.method === "POST" && parsedUrl.pathname.startsWith("/providers/")) {
      if (!this.tokenAllowed(req)) {
        this.unauthorized(res);
        return;
      }
      const segments = parsedUrl.pathname.split("/").filter(Boolean);
      const providerId = segments[1];
      const action = segments[2];
      if (action !== "test") {
        this.writeJson(res, 404, { error: "not_found" });
        return;
      }

      const body = (await this.readJsonBody(req)) as Record<string, unknown>;
      const payload: GatewayMessage = {
        channelId: providerId,
        sourceId: typeof body.sourceId === "string" ? body.sourceId : `test:${providerId}`,
        senderId: typeof body.senderId === "string" ? body.senderId : "provider-test",
        senderName: typeof body.senderName === "string" ? body.senderName : "provider-test",
        content: typeof body.content === "string" ? body.content : `test event for ${providerId}`,
        timestamp: Date.now(),
        direction: "inbound",
        mode: body.mode === "conversational" ? "conversational" : "observational",
        metadata: {
          test: true,
        },
      };
      const outbound = await this.processInboundMessage(payload);
      this.writeJson(res, 200, { accepted: true, outbound });
      return;
    }

    if (req.method === "POST" && parsedUrl.pathname === "/ingest") {
      if (!this.tokenAllowed(req)) {
        this.unauthorized(res);
        return;
      }

      try {
        const payload = parseGatewayMessage(await this.readJsonBody(req));
        // All ingress sources (n8n, pollers, custom bots) funnel through this method.
        const outbound = await this.processInboundMessage(payload);
        this.writeJson(res, 200, { accepted: true, outbound });
      } catch (error) {
        const message = error instanceof Error ? error.message : "invalid_request";
        this.writeJson(res, 400, { error: message });
      }
      return;
    }

    this.writeJson(res, 404, { error: "not_found" });
  }

  private async processInboundMessage(payload: GatewayMessage): Promise<OutboundEnvelope | null> {
    if (!this.router) throw new Error("router_not_ready");
    if (payload.direction !== "inbound") {
      throw new Error("only inbound messages can be ingested");
    }

    const inbound: InboundEnvelope = {
      channelId: payload.channelId,
      sourceId: payload.sourceId,
      senderId: payload.senderId,
      senderName: payload.senderName,
      content: payload.content,
      timestamp: payload.timestamp,
      // HTTP ingress is provider-agnostic; group/thread semantics can be encoded in metadata.
      isGroup: false,
      mode: payload.mode,
      threadId: payload.threadId,
      raw: payload.metadata,
    };
    return this.router.handleInbound(inbound);
  }
}
