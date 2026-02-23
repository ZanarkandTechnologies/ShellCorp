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

import { loadConfig, loadRawConfig, saveRawConfig } from "../config/loader.js";
import { fahrenheitConfigSchema, sensitiveConfigPaths, type FahrenheitConfig } from "../config/schema.js";
import { FileLogSink } from "../logging/file-sink.js";
import { ConsoleLogSink } from "../logging/console-sink.js";
import { ConvexLogSink } from "../logging/convex-sink.js";
import type { LogSink } from "../logging/sink.js";
import { RedactingLogSink } from "../logging/redacting-sink.js";
import { PiBrainRuntime, defaultDataDir } from "../agent/runner.js";
import type { BrainRuntime } from "../agent/runner.js";
import { GatewayRouter } from "./router.js";
import { GatewayBus } from "./bus.js";
import { TelegramChannel } from "../channels/telegram.js";
import { DiscordChannel } from "../channels/discord.js";
import { SlackChannel } from "../channels/slack.js";
import { WhatsAppChannel } from "../channels/whatsapp.js";
import { NotionCommentsChannel } from "../channels/notion.js";
import { CustomEndpointChannel } from "../channels/custom.js";
import type { BaseChannel, ProviderSetupSpec, ProviderStatus } from "../channels/base.js";
import type { GatewayMessage, InboundEnvelope, OutboundEnvelope } from "../types.js";
import { CronManager } from "../scheduler/cron.js";
import { HeartbeatRunner } from "../scheduler/heartbeat.js";
import { inboundToMessage, parseGatewayMessage } from "./schema.js";
import { createMessageStore, type MessageStore } from "./message-store.js";
import { renderGatewayUi } from "./ui.js";
import { OntologyService } from "../ontology/service.js";
import { NotionOntologyAdapter } from "../providers/notion.js";
import { collectSensitiveValues } from "../security/redact.js";
import { isGatewayToolAllowed } from "../security/policy.js";
import { MemoryStore } from "../memory/store.js";
import { ObservationalMemoryPipeline } from "../memory/pipeline.js";
import { formatLogLine } from "../logging/pretty.js";

interface NotionWebhookCapableChannel extends BaseChannel {
  handleWebhook: (
    rawBody: string,
    signatureHeader: string | undefined,
    payload: unknown,
  ) => Promise<{ accepted: boolean; verificationToken?: string; reason?: string }>;
}

class DisabledBrainRuntime {
  async handleMessage(): Promise<string> {
    return "Brain runtime is disabled in config.runtime.ai.enabled.";
  }
  async spawnRoleSession(): Promise<void> {}
  listSessions(): string[] {
    return [];
  }
}

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
  const sensitiveValues = collectSensitiveValues(config, sensitiveConfigPaths);
  if (config.gateway.logSink === "console") return new RedactingLogSink(new ConsoleLogSink(), sensitiveValues);
  if (config.gateway.logSink === "convex") {
    if (!config.gateway.sink.convex?.deploymentUrl) {
      throw new Error("gateway.sink.convex.deploymentUrl is required when gateway.logSink is convex");
    }
    return new RedactingLogSink(
      new ConvexLogSink(config.gateway.sink.convex.deploymentUrl, config.gateway.sink.convex.authToken),
      sensitiveValues,
    );
  }
  return new RedactingLogSink(new FileLogSink(), sensitiveValues);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function setNestedValue(target: Record<string, unknown>, pathParts: string[], value: unknown): void {
  let cursor: Record<string, unknown> = target;
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const key = pathParts[index];
    const current = cursor[key];
    if (!current || typeof current !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[pathParts[pathParts.length - 1]] = value;
}

function redactRawConfig(raw: Record<string, unknown>, sensitivePaths: string[]): Record<string, unknown> {
  const copy = deepClone(raw);
  for (const rawPath of sensitivePaths) {
    const parts = rawPath.split(".");
    let cursor: Record<string, unknown> | null = copy;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const key = parts[index];
      if (!cursor || typeof cursor !== "object" || !(key in cursor)) {
        cursor = null;
        break;
      }
      const next = cursor[key];
      if (!next || typeof next !== "object") {
        cursor = null;
        break;
      }
      cursor = next as Record<string, unknown>;
    }
    if (!cursor) continue;
    const leaf = parts[parts.length - 1];
    if (leaf in cursor) {
      cursor[leaf] = "[redacted]";
    }
  }
  return copy;
}

export class GatewayServer {
  private channels: BaseChannel[] = [];
  private channelById = new Map<string, BaseChannel>();
  private cronManager: CronManager | null = null;
  private heartbeat: HeartbeatRunner | null = null;
  private runtime: BrainRuntime | null = null;
  private config: FahrenheitConfig | null = null;
  private router: GatewayRouter | null = null;
  private messageStore: MessageStore | null = null;
  private httpServer: ReturnType<typeof createServer> | null = null;
  private readonly bus = new GatewayBus();
  private ontologyService: OntologyService | null = null;
  private configPath: string | undefined;
  private logSink: LogSink | null = null;
  private memoryStore: MemoryStore | null = null;
  private observationalMemory: ObservationalMemoryPipeline | null = null;
  private stateVersion = 0;
  private readonly idempotencyCache = new Map<string, { expiresAt: number; payload: unknown }>();

  async start(configPath?: string): Promise<void> {
    this.configPath = configPath;
    this.config = await loadConfig(configPath);
    const workspaceDir = path.resolve(this.config.runtime.workspaceDir);
    await ensureWorkspaceTemplate(workspaceDir);
    this.memoryStore = new MemoryStore(workspaceDir);
    this.observationalMemory = new ObservationalMemoryPipeline(this.memoryStore, {
      promotion: { autoPromoteTrust: this.config.runtime.memory.autoPromoteTrust },
      compression: this.config.runtime.memory.compression,
    });
    const logSink = createLogSink(this.config);
    this.logSink = logSink;
    this.messageStore = createMessageStore(this.config);

    const mockReplyEnabled = this.config.runtime.agent.mockReply.trim().length > 0;
    this.runtime = this.config.runtime.ai.enabled && !mockReplyEnabled
      ? new PiBrainRuntime({
          dataDir: this.config.runtime.dataDir || defaultDataDir(),
          workspaceDir,
          logSink,
          ai: this.config.runtime.ai,
          agent: this.config.runtime.agent,
        })
      : new DisabledBrainRuntime();

    this.router = new GatewayRouter(
      this.config,
      this.runtime,
      logSink,
      this.messageStore,
      this.bus,
      async (payload) => {
        if (!this.observationalMemory) return;
        await this.observationalMemory.recordInboundObservation(payload);
      },
    );
    this.ontologyService = this.buildOntologyService(this.config);
    this.channels = this.buildChannels(this.config);
    this.channelById = new Map(this.channels.map((channel) => [channel.id, channel] as const));
    await this.startHttpApi();
    await this.startChannels(logSink);

    const cronStorePath = this.config.runtime.cron.storePath
      ? path.resolve(this.config.runtime.cron.storePath)
      : path.join(this.config.runtime.dataDir, "cron-jobs.json");
    const cronRunsPath = this.config.runtime.cron.runsPath
      ? path.resolve(this.config.runtime.cron.runsPath)
      : path.join(this.config.runtime.dataDir, "cron-runs.jsonl");
    this.cronManager = new CronManager(this.runtime, logSink, cronStorePath, cronRunsPath);
    await this.cronManager.loadAndStart();
    await this.syncOntologyPollingJobs();

    this.heartbeat = new HeartbeatRunner(
      this.runtime,
      logSink,
      workspaceDir,
      this.config.runtime.heartbeat.intervalMinutes,
      this.config.runtime.heartbeat.promptPath,
      this.config.runtime.heartbeat.sessionKey,
    );
    if (this.config.runtime.heartbeat.enabled) this.heartbeat.start();
  }

  async stop(): Promise<void> {
    this.heartbeat?.stop();
    this.heartbeat = null;
    this.cronManager?.shutdown();
    this.cronManager = null;
    await this.stopHttpApi();
    for (const channel of this.channels) {
      await channel.stop();
    }
    this.channels = [];
    this.channelById.clear();
  }

  private async startChannels(logSink: LogSink): Promise<void> {
    for (const channel of this.channels) {
      channel.setInboundHandler(async (envelope) => {
        const outbound = await this.processInboundMessage(inboundToMessage(envelope));
        if (outbound) {
          await channel.send(outbound);
        }
      });
      void channel.start().catch((error) => {
        void logSink.logAgentAction({
          ts: Date.now(),
          sessionKey: "gateway:channels",
          action: "channel_start_error",
          message: `${channel.id}: ${error instanceof Error ? error.message : "start_failed"}`,
        });
      });
    }
  }

  private async reloadConfigRuntime(): Promise<{
    stateVersion: number;
    channels: string[];
    groups: string[];
  }> {
    if (!this.configPath) {
      throw new Error("config_path_not_available");
    }
    console.info(formatLogLine("gateway", "config_reload_started", {}));
    const nextConfig = await loadConfig(this.configPath);
    const workspaceDir = path.resolve(nextConfig.runtime.workspaceDir);
    await ensureWorkspaceTemplate(workspaceDir);
    this.memoryStore = new MemoryStore(workspaceDir);
    this.observationalMemory = new ObservationalMemoryPipeline(this.memoryStore, {
      promotion: { autoPromoteTrust: nextConfig.runtime.memory.autoPromoteTrust },
      compression: nextConfig.runtime.memory.compression,
    });
    const logSink = createLogSink(nextConfig);
    this.logSink = logSink;
    this.messageStore = createMessageStore(nextConfig);
    const mockReplyEnabled = nextConfig.runtime.agent.mockReply.trim().length > 0;
    this.runtime = nextConfig.runtime.ai.enabled && !mockReplyEnabled
      ? new PiBrainRuntime({
          dataDir: nextConfig.runtime.dataDir || defaultDataDir(),
          workspaceDir,
          logSink,
          ai: nextConfig.runtime.ai,
          agent: nextConfig.runtime.agent,
        })
      : new DisabledBrainRuntime();
    this.router = new GatewayRouter(
      nextConfig,
      this.runtime,
      logSink,
      this.messageStore,
      this.bus,
      async (payload) => {
        if (!this.observationalMemory) return;
        await this.observationalMemory.recordInboundObservation(payload);
      },
    );
    this.ontologyService = this.buildOntologyService(nextConfig);

    this.heartbeat?.stop();
    this.heartbeat = null;
    this.cronManager?.shutdown();
    this.cronManager = null;
    for (const channel of this.channels) {
      await channel.stop();
    }

    this.channels = this.buildChannels(nextConfig);
    this.channelById = new Map(this.channels.map((channel) => [channel.id, channel] as const));
    await this.startChannels(logSink);

    const cronStorePath = nextConfig.runtime.cron.storePath
      ? path.resolve(nextConfig.runtime.cron.storePath)
      : path.join(nextConfig.runtime.dataDir, "cron-jobs.json");
    const cronRunsPath = nextConfig.runtime.cron.runsPath
      ? path.resolve(nextConfig.runtime.cron.runsPath)
      : path.join(nextConfig.runtime.dataDir, "cron-runs.jsonl");
    this.cronManager = new CronManager(this.runtime, logSink, cronStorePath, cronRunsPath);
    await this.cronManager.loadAndStart();
    await this.syncOntologyPollingJobs();

    this.heartbeat = new HeartbeatRunner(
      this.runtime,
      logSink,
      workspaceDir,
      nextConfig.runtime.heartbeat.intervalMinutes,
      nextConfig.runtime.heartbeat.promptPath,
      nextConfig.runtime.heartbeat.sessionKey,
    );
    if (nextConfig.runtime.heartbeat.enabled) {
      this.heartbeat.start();
    }

    this.config = nextConfig;
    console.info(
      formatLogLine("gateway", "config_reload_completed", {
        channels: this.channels.map((channel) => channel.id).join(","),
        groups: Object.keys(nextConfig.gateway.groups).join(","),
      }),
    );
    return {
      stateVersion: this.nextStateVersion(),
      channels: this.channels.map((channel) => channel.id),
      groups: Object.keys(nextConfig.gateway.groups),
    };
  }

  getStatus(): Record<string, unknown> {
    return {
      channels: this.channels.map((c) => c.id),
      sessions: this.runtime?.listSessions() ?? [],
      configuredGroups: this.config ? Object.keys(this.config.gateway.groups) : [],
      mockReply: this.config?.runtime.agent.mockReply ?? "",
      cronJobs: this.cronManager?.listActiveJobIds() ?? [],
      configLoaded: Boolean(this.config),
      gatewayApi: this.config ? `${this.config.gateway.server.host}:${this.config.gateway.server.port}` : null,
      gatewayBind: this.config?.gateway.server.bind ?? "unknown",
      stateVersion: this.stateVersion,
      eventSink: this.config?.gateway.sink.type ?? "unknown",
    };
  }

  private nextStateVersion(): number {
    this.stateVersion += 1;
    return this.stateVersion;
  }

  private pruneIdempotencyCache(now = Date.now()): void {
    for (const [key, value] of this.idempotencyCache.entries()) {
      if (value.expiresAt <= now) this.idempotencyCache.delete(key);
    }
  }

  private getIdempotencyKey(req: IncomingMessage): string | null {
    const value = req.headers["x-idempotency-key"];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private getCachedIdempotencyPayload(req: IncomingMessage): unknown | null {
    this.pruneIdempotencyCache();
    const key = this.getIdempotencyKey(req);
    if (!key) return null;
    const hit = this.idempotencyCache.get(key);
    return hit ? hit.payload : null;
  }

  private setCachedIdempotencyPayload(req: IncomingMessage, payload: unknown): void {
    const key = this.getIdempotencyKey(req);
    if (!key) return;
    this.idempotencyCache.set(key, {
      expiresAt: Date.now() + 10 * 60 * 1000,
      payload,
    });
  }

  private async readRuntimeConfigRaw(): Promise<Record<string, unknown>> {
    return loadRawConfig(this.configPath);
  }

  private async persistRuntimeConfigRaw(raw: Record<string, unknown>): Promise<void> {
    fahrenheitConfigSchema.parse(raw);
    await saveRawConfig(raw, this.configPath);
  }

  private sanitizeConfigRead(raw: Record<string, unknown>): Record<string, unknown> {
    return redactRawConfig(raw, sensitiveConfigPaths);
  }

  private getConfigSection(raw: Record<string, unknown>, section: "channels" | "groups"): Record<string, unknown> {
    const gateway = typeof raw.gateway === "object" && raw.gateway ? (raw.gateway as Record<string, unknown>) : {};
    const value = gateway[section];
    if (typeof value === "object" && value) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private coreProviderIds(): string[] {
    return ["telegram", "discord", "slack", "whatsapp", "notion", "custom"];
  }

  private defaultSetupSpec(providerId: string): ProviderSetupSpec {
    if (providerId === "telegram") {
      return {
        providerId,
        title: "Telegram Bot",
        summary: "Connect Telegram bot token for native inbound/outbound messaging.",
        fields: [
          { key: "gateway.channels.telegram.enabled", label: "Enable channel", required: true, example: "true" },
          { key: "gateway.channels.telegram.botToken", label: "Bot token", required: true, secret: true },
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
          { key: "gateway.channels.discord.enabled", label: "Enable channel", required: true, example: "true" },
          { key: "gateway.channels.discord.token", label: "Bot token", required: true, secret: true },
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
          { key: "gateway.channels.slack.enabled", label: "Enable channel", required: true, example: "true" },
          { key: "gateway.channels.slack.botToken", label: "Bot token", required: true, secret: true },
          { key: "gateway.channels.slack.appToken", label: "App token", required: true, secret: true },
        ],
        docsUrl: "https://api.slack.com/apps",
      };
    }
    if (providerId === "notion") {
      return {
        providerId,
        title: "Notion Comments",
        summary: "Poll or receive webhook comment events and reply using the Notion comments API.",
        fields: [
          { key: "gateway.channels.notion.enabled", label: "Enable channel", required: true, example: "true" },
          { key: "gateway.channels.notion.apiKey", label: "Integration token", required: true, secret: true },
          { key: "gateway.channels.notion.webhookEnabled", label: "Enable webhook endpoint", required: false, example: "true" },
          { key: "gateway.channels.notion.webhookPath", label: "Webhook path", required: false, example: "/webhooks/notion" },
          {
            key: "gateway.channels.notion.approveWebhookPath",
            label: "Approve webhook path",
            required: false,
            example: "/webhook/notion/approve",
          },
          {
            key: "gateway.channels.notion.webhookVerificationToken",
            label: "Webhook verification token",
            required: false,
            secret: true,
          },
          { key: "gateway.channels.notion.requireWakeWord", label: "Require wake word", required: false, example: "true" },
          { key: "gateway.channels.notion.wakeWords", label: "Wake words", required: false, example: "[\"@fahrenheit\"]" },
        ],
        docsUrl: "https://developers.notion.com/reference/comment",
      };
    }
    if (providerId === "custom") {
      return {
        providerId,
        title: "Custom HTTP Endpoint",
        summary: "External systems can push normalized events to gateway ingest endpoint.",
        fields: [
          { key: "gateway.channels.custom.enabled", label: "Enable channel", required: true, example: "true" },
          { key: "gateway.channels.custom.ingestPath", label: "Ingest path", required: false, example: "/ingest" },
        ],
      };
    }
    return {
      providerId: "whatsapp",
      title: "WhatsApp (Native)",
      summary: "Connect WhatsApp via native QR pairing for inbound/outbound messaging.",
      fields: [
        { key: "gateway.channels.whatsapp.enabled", label: "Enable channel", required: true, example: "true" },
        { key: "gateway.server.ingestToken", label: "Ingest token", required: false, secret: true },
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

      const enabled = providerId in this.config.gateway.channels
        ? Boolean(this.config.gateway.channels[providerId as keyof typeof this.config.gateway.channels].enabled)
        : false;
      providers.push({
        setup: this.defaultSetupSpec(providerId),
        status: {
          providerId,
          enabled,
          connected: false,
          mode: providerId === "custom" ? "bridge" : "native",
          lastError: enabled ? "provider_not_started_missing_credentials_or_not_implemented" : undefined,
        },
      });
    }

    return providers;
  }

  private buildChannels(config: FahrenheitConfig): BaseChannel[] {
    const channels: BaseChannel[] = [];
    if (config.gateway.channels.telegram.enabled && config.gateway.channels.telegram.botToken) {
      channels.push(new TelegramChannel(config.gateway.channels.telegram.botToken));
    }
    if (config.gateway.channels.discord.enabled && config.gateway.channels.discord.token) {
      channels.push(new DiscordChannel(config.gateway.channels.discord.token));
    }
    if (
      config.gateway.channels.slack.enabled &&
      config.gateway.channels.slack.botToken &&
      config.gateway.channels.slack.appToken
    ) {
      channels.push(new SlackChannel(config.gateway.channels.slack.botToken, config.gateway.channels.slack.appToken));
    }
    if (config.gateway.channels.whatsapp.enabled) {
      channels.push(new WhatsAppChannel(config.gateway.channels.whatsapp.authDir, config.gateway.channels.whatsapp.printQr));
    }
    if (config.gateway.channels.notion.enabled && config.gateway.channels.notion.apiKey) {
      channels.push(
        new NotionCommentsChannel({
          apiKey: config.gateway.channels.notion.apiKey,
          pageIds: config.gateway.channels.notion.pageIds,
          pollIntervalMs: config.gateway.channels.notion.pollIntervalMs,
          webhookEnabled: config.gateway.channels.notion.webhookEnabled,
          webhookVerificationToken: config.gateway.channels.notion.webhookVerificationToken,
          requireWakeWord: config.gateway.channels.notion.requireWakeWord,
          wakeWords: config.gateway.channels.notion.wakeWords,
        }),
      );
    }
    if (config.gateway.channels.custom.enabled) {
      channels.push(new CustomEndpointChannel());
    }
    return channels;
  }

  private buildOntologyService(config: FahrenheitConfig): OntologyService | null {
    if (!config.ontology.enabled) return null;
    const notionSource = config.ontology.connectors.notion;
    if (!notionSource?.enabled) return null;
    if (!notionSource.apiKey) {
      throw new Error("ontology.connectors.notion.apiKey is required when ontology.connectors.notion.enabled is true");
    }

    const adapter = new NotionOntologyAdapter(notionSource.apiKey);
    return new OntologyService(config, adapter);
  }

  private async syncOntologyPollingJobs(): Promise<void> {
    if (!this.cronManager || !this.config) return;
    if (!this.config.ontology.enabled) return;

    for (const [sourceId, source] of Object.entries(this.config.ontology.connectors)) {
      if (!source.enabled || !source.polling.enabled) continue;
      const prompt = source.polling.prompt.trim() || `Pull updates from ${sourceId} and extract observational memory.`;
      await this.cronManager.addJob({
        id: `ontology-poll:${sourceId}`,
        schedule: source.polling.schedule,
        prompt,
        sessionKey: source.polling.sessionKey,
        enabled: true,
        observation: {
          source: sourceId,
          sourceRef: `ontology.connectors.${sourceId}`,
          projectTags: source.projectTags,
          roleTags: source.roleTags,
          trustClass: source.trustClass,
          confidence: 0.8,
        },
      });
    }
  }

  private async startHttpApi(): Promise<void> {
    if (!this.config) return;
    this.httpServer = createServer((req, res) => {
      void this.handleHttpRequest(req, res);
    });
    await new Promise<void>((resolve, reject) => {
      this.httpServer?.once("error", reject);
      this.httpServer?.listen(this.config?.gateway.server.port, this.config?.gateway.server.host, () => resolve());
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
    const raw = await this.readRawBody(req);
    return raw ? JSON.parse(raw) : {};
  }

  private async readRawBody(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
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
    const expected = this.config?.gateway.server.ingestToken;
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

    const parsedUrl = new URL(req.url ?? "/", `http://${this.config.gateway.server.host}:${this.config.gateway.server.port}`);
    if (req.method === "GET" && parsedUrl.pathname === "/status") {
      this.writeJson(res, 200, this.getStatus());
      return;
    }

    if (req.method === "GET" && (parsedUrl.pathname === "/" || parsedUrl.pathname === "/ui")) {
      const uiUrl = process.env.GATEWAY_UI_URL?.trim() || "http://127.0.0.1:5173";
      res.statusCode = 200;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(renderGatewayUi(uiUrl));
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

    if (req.method === "GET" && parsedUrl.pathname === "/config") {
      const raw = await this.readRuntimeConfigRaw();
      this.writeJson(res, 200, {
        config: this.sanitizeConfigRead(raw),
        stateVersion: this.stateVersion,
      });
      return;
    }

    if (req.method === "GET" && parsedUrl.pathname === "/config/channels") {
      const raw = await this.readRuntimeConfigRaw();
      this.writeJson(res, 200, {
        channels: this.getConfigSection(this.sanitizeConfigRead(raw), "channels"),
        stateVersion: this.stateVersion,
      });
      return;
    }

    if (req.method === "GET" && parsedUrl.pathname === "/config/groups") {
      const raw = await this.readRuntimeConfigRaw();
      this.writeJson(res, 200, {
        groups: this.getConfigSection(this.sanitizeConfigRead(raw), "groups"),
        stateVersion: this.stateVersion,
      });
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
      const cached = this.getCachedIdempotencyPayload(req);
      if (cached) {
        this.writeJson(res, 200, cached);
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
      const response = { accepted: true, outbound, stateVersion: this.nextStateVersion() };
      this.setCachedIdempotencyPayload(req, response);
      this.writeJson(res, 200, response);
      return;
    }

    if (req.method === "POST" && parsedUrl.pathname.startsWith("/config/channels/")) {
      if (!this.tokenAllowed(req)) {
        this.unauthorized(res);
        return;
      }
      const channelId = decodeURIComponent(parsedUrl.pathname.slice("/config/channels/".length)).trim();
      if (!channelId) {
        this.writeJson(res, 400, { error: "channel_id_required" });
        return;
      }
      const body = (await this.readJsonBody(req)) as Record<string, unknown>;
      const raw = await this.readRuntimeConfigRaw();
      setNestedValue(raw, ["gateway", "channels", channelId], body);
      await this.persistRuntimeConfigRaw(raw);
      this.writeJson(res, 200, await this.reloadConfigRuntime());
      return;
    }

    if (req.method === "POST" && parsedUrl.pathname.startsWith("/config/groups/")) {
      if (!this.tokenAllowed(req)) {
        this.unauthorized(res);
        return;
      }
      const groupId = decodeURIComponent(parsedUrl.pathname.slice("/config/groups/".length)).trim();
      if (!groupId) {
        this.writeJson(res, 400, { error: "group_id_required" });
        return;
      }
      const body = (await this.readJsonBody(req)) as Record<string, unknown>;
      const raw = await this.readRuntimeConfigRaw();
      setNestedValue(raw, ["gateway", "groups", groupId], body);
      await this.persistRuntimeConfigRaw(raw);
      this.writeJson(res, 200, await this.reloadConfigRuntime());
      return;
    }

    if (req.method === "DELETE" && parsedUrl.pathname.startsWith("/config/groups/")) {
      if (!this.tokenAllowed(req)) {
        this.unauthorized(res);
        return;
      }
      const groupId = decodeURIComponent(parsedUrl.pathname.slice("/config/groups/".length)).trim();
      if (!groupId) {
        this.writeJson(res, 400, { error: "group_id_required" });
        return;
      }
      const raw = await this.readRuntimeConfigRaw();
      const groups = this.getConfigSection(raw, "groups");
      delete groups[groupId];
      setNestedValue(raw, ["gateway", "groups"], groups);
      await this.persistRuntimeConfigRaw(raw);
      this.writeJson(res, 200, await this.reloadConfigRuntime());
      return;
    }

    if (req.method === "POST" && parsedUrl.pathname === "/config/reload") {
      if (!this.tokenAllowed(req)) {
        this.unauthorized(res);
        return;
      }
      this.writeJson(res, 200, await this.reloadConfigRuntime());
      return;
    }

    if (req.method === "POST" && parsedUrl.pathname === "/config/apply") {
      if (!this.tokenAllowed(req)) {
        this.unauthorized(res);
        return;
      }
      const body = (await this.readJsonBody(req)) as {
        channels?: Record<string, unknown>;
        groups?: Record<string, unknown>;
      };
      const raw = await this.readRuntimeConfigRaw();
      if (body.channels) {
        setNestedValue(raw, ["gateway", "channels"], body.channels);
      }
      if (body.groups) {
        setNestedValue(raw, ["gateway", "groups"], body.groups);
      }
      await this.persistRuntimeConfigRaw(raw);
      this.writeJson(res, 200, await this.reloadConfigRuntime());
      return;
    }

    const notionWebhookPath = this.config.gateway.channels.notion.webhookPath || "/webhooks/notion";
    if (req.method === "POST" && parsedUrl.pathname === notionWebhookPath) {
      const notionChannel = this.channelById.get("notion");
      if (!notionChannel || !("handleWebhook" in notionChannel)) {
        this.writeJson(res, 503, { error: "notion_webhook_not_available" });
        return;
      }
      try {
        const rawBody = await this.readRawBody(req);
        const payload = rawBody ? JSON.parse(rawBody) : {};
        const signatureHeader = typeof req.headers["x-notion-signature"] === "string"
          ? req.headers["x-notion-signature"]
          : undefined;
        const result = await (notionChannel as NotionWebhookCapableChannel).handleWebhook(rawBody, signatureHeader, payload);
        if (result.verificationToken) {
          // Surface Notion's one-time verification token in gateway logs for setup UX.
          console.info(`[notion-webhook] verification_token=${result.verificationToken}`);
        }
        this.writeJson(res, result.accepted ? 200 : 400, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "notion_webhook_invalid_payload";
        this.writeJson(res, 400, { accepted: false, reason: message });
      }
      return;
    }

    const notionApprovePath = this.config.gateway.channels.notion.approveWebhookPath || "/webhook/notion/approve";
    if (req.method === "POST" && parsedUrl.pathname === notionApprovePath) {
      try {
        const body = (await this.readJsonBody(req)) as Record<string, unknown>;
        const contentCandidate = [body.prompt, body.message, body.content].find(
          (entry) => typeof entry === "string" && entry.trim().length > 0,
        );
        if (typeof contentCandidate !== "string") {
          this.writeJson(res, 400, { error: "prompt_or_message_or_content_required" });
          return;
        }
        const metadataFromBody =
          typeof body.metadata === "object" && body.metadata ? (body.metadata as Record<string, unknown>) : {};
        const sourceId = typeof body.sourceId === "string"
          ? body.sourceId
          : typeof body.pageId === "string"
            ? body.pageId
            : "notion:approve";
        const payload: GatewayMessage = {
          channelId: typeof body.channelId === "string" ? body.channelId : "notion",
          sourceId,
          senderId: typeof body.senderId === "string" ? body.senderId : "notion-approve",
          senderName: typeof body.senderName === "string" ? body.senderName : "Notion Approve Button",
          content: contentCandidate,
          timestamp: Date.now(),
          direction: "inbound",
          mode: body.mode === "observational" ? "observational" : "conversational",
          threadId: typeof body.threadId === "string" ? body.threadId : undefined,
          correlationId: typeof body.correlationId === "string" ? body.correlationId : undefined,
          metadata: {
            ...metadataFromBody,
            notionApprove: true,
            isGroup: typeof body.isGroup === "boolean" ? body.isGroup : true,
          },
        };
        const outbound = await this.processInboundMessage(payload);
        this.writeJson(res, 200, { accepted: true, outbound, stateVersion: this.nextStateVersion() });
        console.info(
          formatLogLine("notion-approve", "accepted", {
            sourceId: payload.sourceId,
            senderId: payload.senderId,
            channelId: payload.channelId,
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "notion_approve_invalid_payload";
        this.writeJson(res, 400, { accepted: false, error: message });
      }
      return;
    }

    const ingestPath = this.config.gateway.channels.custom.ingestPath || "/ingest";
    if (req.method === "POST" && parsedUrl.pathname === ingestPath) {
      if (!this.tokenAllowed(req)) {
        this.unauthorized(res);
        return;
      }
      const cached = this.getCachedIdempotencyPayload(req);
      if (cached) {
        this.writeJson(res, 200, cached);
        return;
      }

      try {
        const payload = parseGatewayMessage(await this.readJsonBody(req));
        // All ingress sources (n8n, pollers, custom bots) funnel through this method.
        const outbound = await this.processInboundMessage(payload);
        const response = { accepted: true, outbound, stateVersion: this.nextStateVersion() };
        this.setCachedIdempotencyPayload(req, response);
        this.writeJson(res, 200, response);
      } catch (error) {
        const message = error instanceof Error ? error.message : "invalid_request";
        this.writeJson(res, 400, { error: message });
      }
      return;
    }

    if (req.method === "POST" && parsedUrl.pathname === "/rpc") {
      try {
        const cached = this.getCachedIdempotencyPayload(req);
        if (cached) {
          this.writeJson(res, 200, cached);
          return;
        }
        const request = (await this.readJsonBody(req)) as { method?: string; params?: Record<string, unknown> };
        const method = request.method ?? "";
        const params = request.params ?? {};
        const response = await this.handleRpc(method, params, req);
        const payload = { ok: true, result: response };
        this.setCachedIdempotencyPayload(req, payload);
        this.writeJson(res, 200, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : "rpc_error";
        this.writeJson(res, 400, { ok: false, error: message });
      }
      return;
    }

    this.writeJson(res, 404, { error: "not_found" });
  }

  private async handleRpc(
    method: string,
    params: Record<string, unknown>,
    req: IncomingMessage,
  ): Promise<unknown> {
    if (!this.config || !this.router || !this.messageStore) {
      throw new Error("gateway_not_ready");
    }

    const toolNameByMethod: Record<string, string> = {
      "ingest.message": "ingest",
      "providers.test": "providers.test",
      "ontology.query": "ontology.query",
      "ontology.text": "ontology.text",
      "memory.observation.append": "memory.observation.append",
      "cron.add": "cron.add",
      "cron.update": "cron.update",
      "cron.enable": "cron.enable",
      "cron.disable": "cron.disable",
      "cron.remove": "cron.remove",
    };
    const toolName = toolNameByMethod[method];
    if (toolName && !isGatewayToolAllowed(toolName, this.config.gateway.tools)) {
      throw new Error(`tool_blocked:${toolName}`);
    }

    if (method === "gateway.status") return this.getStatus();
    if (method === "providers.list") return this.listProviders();
    if (method === "providers.setup") {
      const providerId = String(params.providerId ?? "");
      const provider = this.listProviders().find((entry) => entry.status.providerId === providerId);
      if (!provider) throw new Error("provider_not_found");
      return provider.setup;
    }
    if (method === "providers.status") {
      const providerId = String(params.providerId ?? "");
      const provider = this.listProviders().find((entry) => entry.status.providerId === providerId);
      if (!provider) throw new Error("provider_not_found");
      return provider.status;
    }
    if (method === "messages.list") {
      const limitRaw = Number(params.limit ?? 50);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 500)) : 50;
      const channelId = typeof params.channelId === "string" ? params.channelId : undefined;
      return channelId ? this.messageStore.listByChannel(channelId, limit) : this.messageStore.listRecent(limit);
    }
    if (method === "cron.list") {
      if (!this.cronManager) throw new Error("cron_not_ready");
      return this.cronManager.listDefinitions();
    }
    if (method === "cron.runs") {
      if (!this.cronManager) throw new Error("cron_not_ready");
      const limitRaw = Number(params.limit ?? 50);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 200)) : 50;
      return this.cronManager.listRuns(limit);
    }
    if (method === "ontology.mapping.describe") {
      if (!this.ontologyService) throw new Error("ontology_not_enabled");
      return this.ontologyService.getMappingArtifact();
    }
    if (method === "ontology.query") {
      if (!this.ontologyService) throw new Error("ontology_not_enabled");
      const operation = String(params.operation ?? "list");
      const entityType = String(params.entityType ?? "task");
      return this.ontologyService.execute({
        operation: operation as "list" | "get" | "create" | "update" | "search",
        entityType: entityType as "task" | "project" | "goal" | "crmRecord",
        id: typeof params.id === "string" ? params.id : undefined,
        query: typeof params.query === "string" ? params.query : undefined,
        limit: typeof params.limit === "number" ? params.limit : undefined,
        filters: typeof params.filters === "object" && params.filters ? (params.filters as Record<string, unknown>) : undefined,
        payload: typeof params.payload === "object" && params.payload ? (params.payload as Record<string, unknown>) : undefined,
        confirmWrite: Boolean(params.confirmWrite),
      });
    }
    if (method === "ontology.text") {
      if (!this.ontologyService) throw new Error("ontology_not_enabled");
      const text = String(params.text ?? "");
      if (!text.trim()) throw new Error("ontology_text_required");
      return this.ontologyService.executeText(text);
    }
    if (method === "config.get") {
      const raw = await this.readRuntimeConfigRaw();
      return { config: this.sanitizeConfigRead(raw), stateVersion: this.stateVersion };
    }
    if (method === "config.channels.get") {
      const raw = await this.readRuntimeConfigRaw();
      return { channels: this.getConfigSection(this.sanitizeConfigRead(raw), "channels"), stateVersion: this.stateVersion };
    }
    if (method === "config.groups.get") {
      const raw = await this.readRuntimeConfigRaw();
      return { groups: this.getConfigSection(this.sanitizeConfigRead(raw), "groups"), stateVersion: this.stateVersion };
    }

    if (!this.tokenAllowed(req)) {
      throw new Error("unauthorized");
    }

    if (method === "config.reload") {
      return this.reloadConfigRuntime();
    }
    if (method === "config.apply") {
      const channels = typeof params.channels === "object" && params.channels
        ? (params.channels as Record<string, unknown>)
        : undefined;
      const groups = typeof params.groups === "object" && params.groups
        ? (params.groups as Record<string, unknown>)
        : undefined;
      const raw = await this.readRuntimeConfigRaw();
      if (channels) setNestedValue(raw, ["gateway", "channels"], channels);
      if (groups) setNestedValue(raw, ["gateway", "groups"], groups);
      await this.persistRuntimeConfigRaw(raw);
      return this.reloadConfigRuntime();
    }

    if (method === "providers.test") {
      const providerId = String(params.providerId ?? "");
      if (!providerId) throw new Error("provider_id_required");
      const payload: GatewayMessage = {
        channelId: providerId,
        sourceId: typeof params.sourceId === "string" ? params.sourceId : `test:${providerId}`,
        senderId: typeof params.senderId === "string" ? params.senderId : "provider-test",
        senderName: typeof params.senderName === "string" ? params.senderName : "provider-test",
        content: typeof params.content === "string" ? params.content : `test event for ${providerId}`,
        timestamp: Date.now(),
        direction: "inbound",
        mode: params.mode === "conversational" ? "conversational" : "observational",
        metadata: { test: true },
      };
      const outbound = await this.processInboundMessage(payload);
      return { accepted: true, outbound, stateVersion: this.nextStateVersion() };
    }

    if (method === "ingest.message") {
      const payload = parseGatewayMessage(params.payload);
      const outbound = await this.processInboundMessage(payload);
      return { accepted: true, outbound, stateVersion: this.nextStateVersion() };
    }

    if (method === "memory.observation.append") {
      if (!this.observationalMemory) throw new Error("memory_not_ready");
      const summary = String(params.summary ?? "").trim();
      if (!summary) throw new Error("memory_observation_summary_required");
      const source = String(params.source ?? "").trim();
      if (!source) throw new Error("memory_observation_source_required");
      await this.observationalMemory.recordPollingRun(
        {
          ts: Date.now(),
          jobId: String(params.jobId ?? "manual.observation"),
          status: "ok",
          detail: "manual_observation_append",
          correlationId: typeof params.correlationId === "string" ? params.correlationId : undefined,
        },
        {
          source,
          sourceRef: String(params.sourceRef ?? source),
          summary,
          projectTags: Array.isArray(params.projectTags) ? params.projectTags.filter((tag): tag is string => typeof tag === "string") : [],
          roleTags: Array.isArray(params.roleTags) ? params.roleTags.filter((tag): tag is string => typeof tag === "string") : [],
          trustClass:
            params.trustClass === "system" || params.trustClass === "untrusted" || params.trustClass === "trusted"
              ? params.trustClass
              : "trusted",
          confidence: typeof params.confidence === "number" ? params.confidence : 0.8,
          metadata: { via: "rpc" },
        },
      );
      return { ok: true };
    }

    if (method === "cron.add") {
      if (!this.cronManager) throw new Error("cron_not_ready");
      const id = String(params.id ?? "").trim();
      const schedule = String(params.schedule ?? "").trim();
      const prompt = String(params.prompt ?? "").trim();
      const sessionKey = String(params.sessionKey ?? "runtime:main").trim();
      if (!id || !schedule || !prompt) throw new Error("cron_add_requires_id_schedule_prompt");
      await this.cronManager.addJob({ id, schedule, prompt, sessionKey, enabled: true });
      return { ok: true, id };
    }

    if (method === "cron.update") {
      if (!this.cronManager) throw new Error("cron_not_ready");
      const id = String(params.id ?? "").trim();
      if (!id) throw new Error("cron_update_requires_id");
      const changes: {
        schedule?: string;
        prompt?: string;
        sessionKey?: string;
        enabled?: boolean;
      } = {};
      if (typeof params.schedule === "string" && params.schedule.trim()) changes.schedule = params.schedule.trim();
      if (typeof params.prompt === "string" && params.prompt.trim()) changes.prompt = params.prompt.trim();
      if (typeof params.sessionKey === "string" && params.sessionKey.trim()) changes.sessionKey = params.sessionKey.trim();
      if (typeof params.enabled === "boolean") changes.enabled = params.enabled;
      if (Object.keys(changes).length === 0) throw new Error("cron_update_requires_changes");
      const updated = await this.cronManager.updateJob(id, changes);
      return { ok: true, job: updated };
    }

    if (method === "cron.enable" || method === "cron.disable") {
      if (!this.cronManager) throw new Error("cron_not_ready");
      const id = String(params.id ?? "").trim();
      if (!id) throw new Error("cron_toggle_requires_id");
      const enabled = method === "cron.enable";
      const updated = await this.cronManager.setEnabled(id, enabled);
      return { ok: true, job: updated };
    }

    if (method === "cron.remove") {
      if (!this.cronManager) throw new Error("cron_not_ready");
      const id = String(params.id ?? "").trim();
      if (!id) throw new Error("cron_remove_requires_id");
      await this.cronManager.removeJob(id);
      return { ok: true, id };
    }

    throw new Error(`unknown_method:${method}`);
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
      isGroup: Boolean(payload.metadata?.isGroup),
      mode: payload.mode,
      threadId: payload.threadId ?? (typeof payload.metadata?.threadId === "string" ? payload.metadata.threadId : undefined),
      correlationId:
        payload.correlationId ??
        (typeof payload.metadata?.correlationId === "string" ? payload.metadata.correlationId : undefined),
      raw: payload.metadata,
    };
    return this.router.handleInbound(inbound);
  }
}
