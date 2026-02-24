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
import { randomUUID } from "node:crypto";

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
import { getOntologyProviderAdapter } from "../providers/registry.js";
import { collectSensitiveValues } from "../security/redact.js";
import { gatewayRpcMethodToToolName, isGatewayToolAllowed } from "../security/policy.js";
import { MemoryStore } from "../memory/store.js";
import { ObservationalMemoryPipeline } from "../memory/pipeline.js";
import { searchMemory } from "../memory/search.js";
import { formatLogLine } from "../logging/pretty.js";
import { SkillManager } from "../skills/manager.js";
import {
  commitProofToMemory,
  discoverConnectorSources,
  proposeConnectorOnboarding,
  runConnectorProof,
  type ConnectorProofResult,
} from "../skills/bootstrap.js";
import type { ObservationEvent, ObservationSignalType, ObservationTrustClass } from "../types.js";

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

function controlRpcUrlForConfig(config: FahrenheitConfig): string {
  const host = config.gateway.server.host === "0.0.0.0" ? "127.0.0.1" : config.gateway.server.host;
  return `http://${host}:${config.gateway.server.port}/rpc`;
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

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...(truncated)`;
}

function extractApproveFields(payload: Record<string, unknown>): { url: string; id: string; title: string; status: string } {
  const out = { url: "", id: "", title: "", status: "" };
  const seen = new Set<unknown>();
  const notionUrlRegex = /https:\/\/www\.notion\.so\/[^\s"'`]+/i;

  const pushFromKey = (key: string, value: unknown): void => {
    if (typeof value !== "string") return;
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!out.url && ["url", "pageurl", "notionurl"].includes(normalizedKey)) out.url = value;
    if (!out.id && ["id", "pageid", "notionid", "blockid"].includes(normalizedKey)) out.id = value;
    if (!out.title && ["title", "name", "pagetitle"].includes(normalizedKey)) out.title = value;
    if (!out.status && ["status", "state", "ticketstatus"].includes(normalizedKey)) out.status = value;
    if (!out.url) {
      const urlMatch = value.match(notionUrlRegex);
      if (urlMatch?.[0]) out.url = urlMatch[0];
    }
  };

  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") {
      if (typeof value === "string" && !out.url) {
        const urlMatch = value.match(notionUrlRegex);
        if (urlMatch?.[0]) out.url = urlMatch[0];
      }
      return;
    }
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      pushFromKey(key, nested);
      visit(nested);
    }
  };

  visit(payload);

  if (!out.id && out.url) {
    const compact = out.url.replace(/-/g, "").match(/[0-9a-fA-F]{32}/)?.[0];
    if (compact) out.id = compact.toLowerCase();
  }

  return out;
}

function applyApproveTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(url|id|title|status|source|json)\}/g, (_match, key: string) => values[key] ?? "");
}

export interface MemoryObservationFilters {
  projectId?: string;
  groupId?: string;
  sessionKey?: string;
  source?: string;
  projectTag?: string;
  trustClass?: ObservationTrustClass;
  signalType?: ObservationSignalType;
  status?: "accepted" | "pending_review";
}

export interface MemoryStats {
  totalObservations: number;
  pendingReview: number;
  byTrustClass: Record<ObservationTrustClass, number>;
  bySignalType: Record<ObservationSignalType, number>;
  recentActivity: {
    last24h: number;
    last7d: number;
  };
}

export function filterObservations(
  observations: ObservationEvent[],
  filters: MemoryObservationFilters,
): ObservationEvent[] {
  return observations.filter((event) => {
    if (filters.projectId && event.projectId !== filters.projectId) return false;
    if (filters.groupId && event.groupId !== filters.groupId) return false;
    if (filters.sessionKey && event.sessionKey !== filters.sessionKey) return false;
    if (filters.source && event.source !== filters.source) return false;
    if (filters.projectTag && !event.projectTags.includes(filters.projectTag)) return false;
    if (filters.trustClass && event.trustClass !== filters.trustClass) return false;
    if (filters.signalType && !event.signals.some((signal) => signal.type === filters.signalType)) return false;
    if (filters.status && event.status !== filters.status) return false;
    return true;
  });
}

export function buildMemoryStats(observations: ObservationEvent[], nowMs = Date.now()): MemoryStats {
  const byTrustClass: Record<ObservationTrustClass, number> = {
    trusted: 0,
    untrusted: 0,
    system: 0,
  };
  const bySignalType: Record<ObservationSignalType, number> = {
    blocker: 0,
    risk: 0,
    upsell: 0,
    improvement: 0,
  };
  let last24h = 0;
  let last7d = 0;
  let pendingReview = 0;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const sevenDayMs = 7 * oneDayMs;
  for (const event of observations) {
    byTrustClass[event.trustClass] += 1;
    if (event.status === "pending_review") pendingReview += 1;
    for (const signal of event.signals) {
      bySignalType[signal.type] += 1;
    }
    const ageMs = nowMs - Date.parse(event.occurredAt);
    if (Number.isFinite(ageMs) && ageMs <= sevenDayMs) {
      last7d += 1;
      if (ageMs <= oneDayMs) {
        last24h += 1;
      }
    }
  }
  return {
    totalObservations: observations.length,
    pendingReview,
    byTrustClass,
    bySignalType,
    recentActivity: {
      last24h,
      last7d,
    },
  };
}

export function groupIdFromSessionKey(sessionKey: string): string | null {
  const trimmed = sessionKey.trim();
  if (!trimmed.startsWith("group:")) return null;
  const parts = trimmed.split(":");
  return parts.length >= 2 ? parts[1] ?? null : null;
}

export function groupRollupJobId(groupId: string): string {
  return `group:${groupId}:daily-rollup`;
}

export function isGroupRollupJob(jobId: string): boolean {
  return /^group:[^:]+:daily-rollup$/.test(jobId);
}

export function groupIdFromRollupJobId(jobId: string): string | null {
  if (!isGroupRollupJob(jobId)) return null;
  const parts = jobId.split(":");
  return parts[1] ?? null;
}

export function buildGroupRollupPrompt(groupId: string, channels: string[]): string {
  const sourceList = channels.join(", ") || "no configured sources";
  return [
    `Run end-of-day rollup for group ${groupId}.`,
    "1) Fetch delta from all configured group sources for the past 24h.",
    "2) Correlate cross-source workflow events, blockers, risks, upsell and improvements.",
    "3) Append observations with required groupId and sessionKey partition metadata.",
    `Sources: ${sourceList}.`,
  ].join(" ");
}

function readPartitionQueryParams(parsedUrl: URL): {
  projectId?: string;
  groupId?: string;
  sessionKey?: string;
  allowPartitionOverride: boolean;
} {
  const projectId = parsedUrl.searchParams.get("projectId") ?? undefined;
  const groupId = parsedUrl.searchParams.get("groupId") ?? undefined;
  const sessionKey = parsedUrl.searchParams.get("sessionKey") ?? undefined;
  const allowPartitionOverride = parsedUrl.searchParams.get("allowPartitionOverride") === "1";
  return { projectId, groupId, sessionKey, allowPartitionOverride };
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
  private skillManager: SkillManager | null = null;
  private readonly connectorProofCache = new Map<string, ConnectorProofResult>();
  private stateVersion = 0;
  private readonly idempotencyCache = new Map<string, { expiresAt: number; payload: unknown }>();

  async start(configPath?: string): Promise<void> {
    this.configPath = configPath;
    this.config = await loadConfig(configPath);
    const workspaceDir = path.resolve(this.config.runtime.workspaceDir);
    await ensureWorkspaceTemplate(workspaceDir);
    this.memoryStore = new MemoryStore(workspaceDir, {
      convex:
        this.config.runtime.memory.storage === "convex" && this.config.gateway.sink.convex?.deploymentUrl
          ? {
              deploymentUrl: this.config.gateway.sink.convex.deploymentUrl,
              authToken: this.config.gateway.sink.convex.authToken,
            }
          : undefined,
    });
    this.skillManager = new SkillManager(path.join(workspaceDir, "skills"));
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
          gatewayControl: {
            rpcUrl: controlRpcUrlForConfig(this.config),
            ingestToken: this.config.gateway.server.ingestToken,
            toolsPolicy: this.config.gateway.tools,
          },
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
    this.cronManager = new CronManager(
      this.runtime,
      logSink,
      cronStorePath,
      cronRunsPath,
      async (run, def) => this.handleCronRunComplete(run, def),
    );
    await this.cronManager.loadAndStart();
    await this.syncGroupRollupJobs();

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
    this.memoryStore = new MemoryStore(workspaceDir, {
      convex:
        nextConfig.runtime.memory.storage === "convex" && nextConfig.gateway.sink.convex?.deploymentUrl
          ? {
              deploymentUrl: nextConfig.gateway.sink.convex.deploymentUrl,
              authToken: nextConfig.gateway.sink.convex.authToken,
            }
          : undefined,
    });
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
          gatewayControl: {
            rpcUrl: controlRpcUrlForConfig(nextConfig),
            ingestToken: nextConfig.gateway.server.ingestToken,
            toolsPolicy: nextConfig.gateway.tools,
          },
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
    this.cronManager = new CronManager(
      this.runtime,
      logSink,
      cronStorePath,
      cronRunsPath,
      async (run, def) => this.handleCronRunComplete(run, def),
    );
    await this.cronManager.loadAndStart();
    await this.syncGroupRollupJobs();

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
    const connectorPaths = Object.keys(this.config?.ontology.connectors ?? {}).map(
      (connectorId) => `ontology.connectors.${connectorId}.apiKey`,
    );
    return redactRawConfig(raw, [...sensitiveConfigPaths, ...connectorPaths]);
  }

  private getConfigSection(raw: Record<string, unknown>, section: "channels" | "groups" | "ontology"): Record<string, unknown> {
    if (section === "ontology") {
      const ontology = raw.ontology;
      if (typeof ontology === "object" && ontology) {
        return ontology as Record<string, unknown>;
      }
      return {};
    }
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
    for (const [connectorId, connector] of Object.entries(config.ontology.connectors)) {
      if (!connector.enabled) continue;
      const adapter = getOntologyProviderAdapter({ connectorId, connector });
      return new OntologyService(config, adapter, connectorId);
    }
    return null;
  }

  private async syncGroupRollupJobs(): Promise<void> {
    if (!this.cronManager || !this.config) return;
    const schedule = this.config.runtime.memory.groupRollup.schedule;
    const expected = new Set<string>();
    for (const [groupId, group] of Object.entries(this.config.gateway.groups)) {
      const id = groupRollupJobId(groupId);
      expected.add(id);
      const channels = [...new Set(group.sources.map((source) => source.channel))];
      await this.cronManager.addJob({
        id,
        schedule,
        prompt: buildGroupRollupPrompt(groupId, channels),
        sessionKey: `group:${groupId}:main`,
        enabled: true,
        observation: {
          source: "group-rollup",
          sourceRef: `gateway.groups.${groupId}`,
          projectTags: [groupId],
          trustClass: "system",
          confidence: 0.85,
        },
      });
    }
    const definitions = await this.cronManager.listDefinitions();
    await Promise.all(
      definitions
        .filter((def) => isGroupRollupJob(def.id) && !expected.has(def.id))
        .map((def) => this.cronManager?.removeJob(def.id)),
    );
  }

  private async handleCronRunComplete(
    run: { ts: number; jobId: string; correlationId?: string; status: "ok" | "error"; detail: string; elapsedMs?: number },
    def: {
      id: string;
      schedule: string;
      prompt: string;
      sessionKey: string;
      enabled: boolean;
      observation?: {
        source: string;
        sourceRef: string;
        projectTags?: string[];
        roleTags?: string[];
        trustClass?: ObservationTrustClass;
        confidence?: number;
      };
    },
  ): Promise<void> {
    if (!this.observationalMemory || !this.config || !this.messageStore) return;
    if (!isGroupRollupJob(def.id)) return;
    const groupId = groupIdFromSessionKey(def.sessionKey);
    if (!groupId) return;
    const group = this.config.gateway.groups[groupId];
    if (!group) return;

    const maxWrites = Math.max(1, this.config.runtime.memory.groupRollup.maxWrites);
    const lowConfidenceThreshold = this.config.runtime.memory.groupRollup.lowConfidenceThreshold;
    const dedupeBucketMinutes = Math.max(1, this.config.runtime.memory.groupRollup.dedupeBucketMinutes);
    const aggregate = await this.collectGroupDailyDelta(groupId);

    const dedupe = new Set<string>();
    const summaries = [...aggregate.entries.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, maxWrites);
    for (const [key, value] of summaries) {
      const [source] = key.split(":");
      const bucket = Math.floor(value.latestTs / (dedupeBucketMinutes * 60 * 1000));
      const dedupeKey = `${groupId}:${source}:${value.sourceRef}:${bucket}`;
      if (dedupe.has(dedupeKey)) continue;
      dedupe.add(dedupeKey);
      const confidence = Math.min(0.95, 0.55 + Math.min(value.count, 40) / 100);
      await this.observationalMemory.recordPollingRun(run, {
        projectId: groupId,
        groupId,
        sessionKey: def.sessionKey,
        source,
        sourceRef: value.sourceRef,
        summary: `Nightly group rollup captured ${value.count} updates from ${source} for ${groupId}. Sample: ${truncateText(value.sample, 180)}`,
        projectTags: [groupId],
        roleTags: ["operator"],
        trustClass: "system",
        confidence,
        category: confidence < lowConfidenceThreshold ? "blocker_risk" : "progress_delta",
        rationale: `Rollup aggregation from ${source} with ${value.count} observed updates in the lookback window.`,
        provenanceRefs: [value.sourceRef],
        metadata: {
          rollup: true,
          pendingReview: confidence < lowConfidenceThreshold,
          inputCount: value.count,
          totalInputs: aggregate.totalInputs,
        },
      });
    }
  }

  private async collectGroupDailyDelta(groupId: string): Promise<{
    entries: Map<string, { count: number; latestTs: number; sample: string; sourceRef: string }>;
    totalInputs: number;
  }> {
    if (!this.config || !this.messageStore) {
      return { entries: new Map(), totalInputs: 0 };
    }
    const group = this.config.gateway.groups[groupId];
    if (!group) return { entries: new Map(), totalInputs: 0 };
    const now = Date.now();
    const lookbackMs = Math.max(1, this.config.runtime.memory.groupRollup.lookbackHours) * 60 * 60 * 1000;
    const maxInputs = Math.max(1, this.config.runtime.memory.groupRollup.maxInputs);
    const sourceChannels = new Set(group.sources.map((source) => source.channel));
    const rows = await this.messageStore.listRecent(maxInputs * 3);
    const candidates = rows
      .filter((row) => row.direction === "inbound")
      .filter((row) => row.timestamp >= now - lookbackMs)
      .filter((row) => sourceChannels.has(row.channelId))
      .filter((row) => {
        const groupFromMeta = typeof row.metadata?.groupId === "string" ? row.metadata.groupId : "";
        return groupFromMeta === groupId;
      })
      .slice(0, maxInputs);
    const perSource = new Map<string, { count: number; latestTs: number; sample: string; sourceRef: string }>();
    for (const row of candidates) {
      const key = `${row.channelId}:${row.sourceId}`;
      const existing = perSource.get(key);
      if (!existing) {
        perSource.set(key, {
          count: 1,
          latestTs: row.timestamp,
          sample: row.content,
          sourceRef: row.sourceId,
        });
        continue;
      }
      perSource.set(key, {
        ...existing,
        count: existing.count + 1,
        latestTs: Math.max(existing.latestTs, row.timestamp),
        sample: existing.sample || row.content,
      });
    }
    return {
      entries: perSource,
      totalInputs: candidates.length,
    };
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

  private tokenAllowedWithQuery(req: IncomingMessage, queryToken?: string | null): boolean {
    const expected = this.config?.gateway.server.ingestToken;
    if (!expected) return true;
    const header = req.headers.authorization;
    if (header && header.startsWith("Bearer ") && header.slice(7) === expected) {
      return true;
    }
    return Boolean(queryToken && queryToken === expected);
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

    if (req.method === "GET" && parsedUrl.pathname === "/config/ontology") {
      const raw = await this.readRuntimeConfigRaw();
      this.writeJson(res, 200, {
        ontology: this.getConfigSection(this.sanitizeConfigRead(raw), "ontology"),
        stateVersion: this.stateVersion,
      });
      return;
    }

    if (req.method === "GET" && parsedUrl.pathname === "/memory/stats") {
      if (!this.memoryStore) {
        this.writeJson(res, 503, { error: "memory_not_ready" });
        return;
      }
      const partition = readPartitionQueryParams(parsedUrl);
      if ((!partition.projectId || !partition.groupId) && !partition.allowPartitionOverride) {
        this.writeJson(res, 400, { error: "memory_partition_requires_project_and_group", hint: "Set projectId+groupId or allowPartitionOverride=1" });
        return;
      }
      const observations = await this.memoryStore.listObservations(5000, {
        projectId: partition.projectId,
        groupId: partition.groupId,
        sessionKey: partition.sessionKey,
      });
      this.writeJson(res, 200, {
        stats: buildMemoryStats(observations),
      });
      return;
    }

    if (req.method === "GET" && parsedUrl.pathname === "/memory/observations") {
      if (!this.memoryStore) {
        this.writeJson(res, 503, { error: "memory_not_ready" });
        return;
      }
      const limitRaw = Number(parsedUrl.searchParams.get("limit") ?? "200");
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 5000)) : 200;
      const source = parsedUrl.searchParams.get("source") ?? undefined;
      const partition = readPartitionQueryParams(parsedUrl);
      if ((!partition.projectId || !partition.groupId) && !partition.allowPartitionOverride) {
        this.writeJson(res, 400, { error: "memory_partition_requires_project_and_group", hint: "Set projectId+groupId or allowPartitionOverride=1" });
        return;
      }
      const projectTag = parsedUrl.searchParams.get("projectTag") ?? undefined;
      const trustClassParam = parsedUrl.searchParams.get("trustClass");
      const trustClass =
        trustClassParam === "trusted" || trustClassParam === "untrusted" || trustClassParam === "system"
          ? trustClassParam
          : undefined;
      const signalTypeParam = parsedUrl.searchParams.get("signalType");
      const signalType =
        signalTypeParam === "blocker" ||
        signalTypeParam === "risk" ||
        signalTypeParam === "upsell" ||
        signalTypeParam === "improvement"
          ? signalTypeParam
          : undefined;
      const statusParam = parsedUrl.searchParams.get("status");
      const status = statusParam === "accepted" || statusParam === "pending_review" ? statusParam : undefined;
      const observations = await this.memoryStore.listObservations(limit, {
        projectId: partition.projectId,
        groupId: partition.groupId,
        sessionKey: partition.sessionKey,
        source,
        projectTag,
        trustClass,
        signalType,
        status,
      });
      const filtered = filterObservations(observations, {
        projectId: partition.projectId,
        groupId: partition.groupId,
        sessionKey: partition.sessionKey,
        source,
        projectTag,
        trustClass,
        signalType,
        status,
      });
      this.writeJson(res, 200, {
        observations: filtered,
        total: filtered.length,
        limit,
      });
      return;
    }

    if (req.method === "GET" && parsedUrl.pathname === "/memory/summary") {
      if (!this.memoryStore) {
        this.writeJson(res, 503, { error: "memory_not_ready" });
        return;
      }
      const partition = readPartitionQueryParams(parsedUrl);
      if ((!partition.projectId || !partition.groupId) && !partition.allowPartitionOverride) {
        this.writeJson(res, 400, { error: "memory_partition_requires_project_and_group", hint: "Set projectId+groupId or allowPartitionOverride=1" });
        return;
      }
      const content = await this.memoryStore.readMemory({
        projectId: partition.projectId,
        groupId: partition.groupId,
        sessionKey: partition.sessionKey,
      });
      this.writeJson(res, 200, { content });
      return;
    }

    if (req.method === "GET" && parsedUrl.pathname === "/memory/history") {
      if (!this.memoryStore) {
        this.writeJson(res, 503, { error: "memory_not_ready" });
        return;
      }
      const lineLimitRaw = Number(parsedUrl.searchParams.get("limit") ?? "0");
      const partition = readPartitionQueryParams(parsedUrl);
      if ((!partition.projectId || !partition.groupId) && !partition.allowPartitionOverride) {
        this.writeJson(res, 400, { error: "memory_partition_requires_project_and_group", hint: "Set projectId+groupId or allowPartitionOverride=1" });
        return;
      }
      const content = await this.memoryStore.readHistory({
        projectId: partition.projectId,
        groupId: partition.groupId,
        sessionKey: partition.sessionKey,
      });
      const lineLimit = Number.isFinite(lineLimitRaw) ? Math.max(0, Math.min(lineLimitRaw, 5000)) : 0;
      if (lineLimit === 0) {
        this.writeJson(res, 200, { content });
        return;
      }
      const lines = content.split(/\r?\n/).filter(Boolean);
      const limitedContent = lines.slice(Math.max(0, lines.length - lineLimit)).join("\n");
      this.writeJson(res, 200, { content: limitedContent });
      return;
    }

    if (req.method === "GET" && parsedUrl.pathname === "/memory/search") {
      if (!this.memoryStore) {
        this.writeJson(res, 503, { error: "memory_not_ready" });
        return;
      }
      const query = (parsedUrl.searchParams.get("query") ?? "").trim();
      if (!query) {
        this.writeJson(res, 400, { error: "query_required" });
        return;
      }
      const limitRaw = Number(parsedUrl.searchParams.get("limit") ?? "50");
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 200)) : 50;
      const partition = readPartitionQueryParams(parsedUrl);
      if ((!partition.projectId || !partition.groupId) && !partition.allowPartitionOverride) {
        this.writeJson(res, 400, { error: "memory_partition_requires_project_and_group", hint: "Set projectId+groupId or allowPartitionOverride=1" });
        return;
      }
      const results = (await searchMemory(this.memoryStore, query, {
        projectId: partition.projectId,
        groupId: partition.groupId,
        sessionKey: partition.sessionKey,
      })).slice(0, limit);
      this.writeJson(res, 200, {
        query,
        results,
      });
      return;
    }

    if (req.method === "GET" && parsedUrl.pathname === "/memory/rollups") {
      if (!this.cronManager || !this.memoryStore) {
        this.writeJson(res, 503, { error: "memory_not_ready" });
        return;
      }
      const runs = await this.cronManager.listRuns(200);
      const groupRuns = runs.filter((run) => isGroupRollupJob(run.jobId)).slice(0, 50);
      const groups = [...new Set(groupRuns.map((run) => groupIdFromRollupJobId(run.jobId)).filter(Boolean) as string[])];
      const counts = await Promise.all(
        groups.map(async (groupId) => {
          const observations = await this.memoryStore?.listObservations(5000, { groupId });
          return [groupId, observations?.length ?? 0] as const;
        }),
      );
      const byGroup = Object.fromEntries(counts);
      this.writeJson(res, 200, {
        runs: groupRuns,
        byGroup,
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

    if (req.method === "POST" && parsedUrl.pathname.startsWith("/config/ontology/connectors/")) {
      if (!this.tokenAllowed(req)) {
        this.unauthorized(res);
        return;
      }
      const connectorId = decodeURIComponent(parsedUrl.pathname.slice("/config/ontology/connectors/".length)).trim();
      if (!connectorId) {
        this.writeJson(res, 400, { error: "connector_id_required" });
        return;
      }
      const body = (await this.readJsonBody(req)) as Record<string, unknown>;
      const raw = await this.readRuntimeConfigRaw();
      setNestedValue(raw, ["ontology", "connectors", connectorId], body);
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
        ontology?: Record<string, unknown>;
      };
      const raw = await this.readRuntimeConfigRaw();
      if (body.channels) {
        setNestedValue(raw, ["gateway", "channels"], body.channels);
      }
      if (body.groups) {
        setNestedValue(raw, ["gateway", "groups"], body.groups);
      }
      if (body.ontology) {
        setNestedValue(raw, ["ontology"], body.ontology);
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
    if (req.method === "POST" && (parsedUrl.pathname === notionApprovePath || parsedUrl.pathname === "/approve")) {
      const queryToken = parsedUrl.searchParams.get("token");
      if (!this.tokenAllowedWithQuery(req, queryToken)) {
        this.unauthorized(res);
        return;
      }
      try {
        const body = (await this.readJsonBody(req)) as Record<string, unknown>;
        const extracted = extractApproveFields(body);
        const finalSource =
          (typeof req.headers["x-approval-source"] === "string" ? req.headers["x-approval-source"] : undefined) ??
          parsedUrl.searchParams.get("source") ??
          "webhook";
        const promptTemplate =
          (typeof req.headers["x-nanobot-prompt"] === "string" ? req.headers["x-nanobot-prompt"] : undefined) ??
          parsedUrl.searchParams.get("prompt") ??
          (
            "Go work on ticket {url}. It has been approved.\n" +
            "Status: {status}\n" +
            "Source: {source}\n" +
            "NotionPageId: {id}\n" +
            "Title: {title}\n\n" +
            "Here is the raw webhook payload (JSON). Use it as needed:\n" +
            "```json\n{json}\n```\n"
          );
        const jsonString = truncateText(JSON.stringify(body), 4000);
        const message = applyApproveTemplate(promptTemplate, {
          url: extracted.url,
          id: extracted.id,
          title: extracted.title,
          status: extracted.status,
          source: finalSource,
          json: jsonString,
        });

        const requestId = randomUUID();
        const metadataFromBody =
          typeof body.metadata === "object" && body.metadata ? (body.metadata as Record<string, unknown>) : {};
        const sourceId = typeof body.sourceId === "string"
          ? body.sourceId
          : typeof body.pageId === "string"
            ? body.pageId
            : extracted.id || `approve:${requestId}`;
        const payload: GatewayMessage = {
          channelId: typeof body.channelId === "string" ? body.channelId : "notion",
          sourceId,
          senderId: typeof body.senderId === "string" ? body.senderId : `notion-approve:${requestId}`,
          senderName: typeof body.senderName === "string" ? body.senderName : "Notion Approve Button",
          content: message,
          timestamp: Date.now(),
          direction: "inbound",
          mode: body.mode === "observational" ? "observational" : "conversational",
          threadId: typeof body.threadId === "string" ? body.threadId : undefined,
          correlationId: typeof body.correlationId === "string" ? body.correlationId : undefined,
          metadata: {
            ...metadataFromBody,
            notionApprove: true,
            approvalSource: finalSource,
            approvalUrl: extracted.url,
            approvalId: extracted.id,
            approvalTitle: extracted.title,
            approvalStatus: extracted.status,
            isGroup: typeof body.isGroup === "boolean" ? body.isGroup : false,
          },
        };
        const outbound = await this.processInboundMessage(payload);
        this.writeJson(res, 200, { accepted: true, outbound, stateVersion: this.nextStateVersion() });
        console.info(
          formatLogLine("notion-approve", "accepted", {
            requestId,
            sourceId: payload.sourceId,
            senderId: payload.senderId,
            channelId: payload.channelId,
            approvalSource: finalSource,
            url: truncateText(extracted.url, 200),
            id: truncateText(extracted.id, 80),
            title: truncateText(extracted.title, 120),
            status: truncateText(extracted.status, 80),
            messagePreview: truncateText(message, 500),
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

    const toolName = gatewayRpcMethodToToolName(method);
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
    if (method === "group.rollup.aggregate") {
      const groupId = String(params.groupId ?? "").trim();
      if (!groupId) throw new Error("group_id_required");
      const aggregate = await this.collectGroupDailyDelta(groupId);
      const entries = [...aggregate.entries.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([key, value]) => ({
          sourceKey: key,
          count: value.count,
          latestTs: value.latestTs,
          sourceRef: value.sourceRef,
          sample: truncateText(value.sample, 220),
        }));
      return {
        groupId,
        totalInputs: aggregate.totalInputs,
        entries,
      };
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
    if (method === "connector.onboarding.discover") {
      if (!this.config) throw new Error("gateway_not_ready");
      const connectorId = String(params.connectorId ?? "notion").trim();
      const discovery = await discoverConnectorSources(this.config, connectorId);
      return {
        ok: true,
        connectorId,
        platform: discovery.platform,
        sources: discovery.sources,
      };
    }
    if (method === "connector.onboarding.propose") {
      if (!this.config) throw new Error("gateway_not_ready");
      const connectorId = String(params.connectorId ?? "notion").trim();
      const selectedSourceIds = Array.isArray(params.selectedSourceIds)
        ? params.selectedSourceIds.filter((entry): entry is string => typeof entry === "string")
        : undefined;
      const proposal = await proposeConnectorOnboarding(
        this.config.runtime.workspaceDir,
        this.config,
        connectorId,
        selectedSourceIds,
      );
      return {
        ok: true,
        ...proposal,
      };
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
    if (method === "config.ontology.get") {
      const raw = await this.readRuntimeConfigRaw();
      return { ontology: this.getConfigSection(this.sanitizeConfigRead(raw), "ontology"), stateVersion: this.stateVersion };
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
      const ontology = typeof params.ontology === "object" && params.ontology
        ? (params.ontology as Record<string, unknown>)
        : undefined;
      const raw = await this.readRuntimeConfigRaw();
      if (channels) setNestedValue(raw, ["gateway", "channels"], channels);
      if (groups) setNestedValue(raw, ["gateway", "groups"], groups);
      if (ontology) setNestedValue(raw, ["ontology"], ontology);
      await this.persistRuntimeConfigRaw(raw);
      return this.reloadConfigRuntime();
    }
    if (method === "connector.onboarding.commit") {
      const connectorId = String(params.connectorId ?? "").trim();
      if (!connectorId) throw new Error("connector_id_required");
      const mappings = Array.isArray(params.mappings) ? params.mappings : [];
      if (mappings.length === 0) throw new Error("onboarding_commit_requires_mappings");
      const raw = await this.readRuntimeConfigRaw();
      const rawConnector = this.getConfigSection(raw, "ontology").connectors as Record<string, unknown> | undefined;
      const connectors = rawConnector && typeof rawConnector === "object" ? rawConnector : {};
      const connector = connectors[connectorId];
      if (!connector || typeof connector !== "object") throw new Error(`connector_not_found:${connectorId}`);
      const entityPatch: Record<string, unknown> = {};
      for (const mapping of mappings) {
        if (!mapping || typeof mapping !== "object") continue;
        const entityType = String((mapping as Record<string, unknown>).entityType ?? "").trim();
        const databaseId = String((mapping as Record<string, unknown>).databaseId ?? "").trim();
        if (!entityType || !databaseId) continue;
        entityPatch[entityType] = { databaseId };
      }
      if (Object.keys(entityPatch).length === 0) throw new Error("onboarding_commit_requires_valid_database_ids");
      const connectorRecord = connector as Record<string, unknown>;
      const existingEntities =
        connectorRecord.entities && typeof connectorRecord.entities === "object"
          ? connectorRecord.entities as Record<string, unknown>
          : {};
      const nextEntities = {
        ...existingEntities,
      };
      for (const [entityType, patch] of Object.entries(entityPatch)) {
        const prev = existingEntities[entityType];
        nextEntities[entityType] = {
          ...(prev && typeof prev === "object" ? prev as Record<string, unknown> : {}),
          ...(patch as Record<string, unknown>),
        };
      }
      const nextConnector = {
        ...connectorRecord,
        entities: nextEntities,
      };
      const nextConnectors = {
        ...connectors,
        [connectorId]: nextConnector,
      };
      setNestedValue(raw, ["ontology", "connectors"], nextConnectors);
      await this.persistRuntimeConfigRaw(raw);
      const reloaded = await this.reloadConfigRuntime();
      return {
        ok: true,
        connectorId,
        appliedMappings: Object.keys(entityPatch).length,
        ...reloaded,
      };
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

    if (method === "skills.execute") {
      if (!this.skillManager) throw new Error("skills_not_ready");
      const name = String(params.name ?? "").trim();
      if (!name) throw new Error("skill_name_required");
      const args = typeof params.args === "object" && params.args ? params.args as Record<string, string> : {};
      const result = await this.skillManager.executeSkill(name, args, {
        allowUntrusted: Boolean(params.allowUntrusted),
        allowWriteCapable: Boolean(params.allowWriteCapable),
      });
      return { ok: true, result };
    }

    if (method === "connector.bootstrap.preview" || method === "connector.bootstrap.prove") {
      if (!this.config || !this.ontologyService) throw new Error("ontology_not_enabled");
      const connectorId = String(params.connectorId ?? "notion").trim();
      const proof = await runConnectorProof(this.config.runtime.workspaceDir, this.config, this.ontologyService, connectorId);
      this.connectorProofCache.set(connectorId, proof);
      return {
        ok: true,
        connectorId,
        confidence: proof.confidence,
        generatedSkillPath: proof.generatedSkillPath,
        evidencePath: proof.evidencePath,
        fetchedCount: proof.fetchedRecords.length,
        preview: proof.observationPreview,
      };
    }

    if (method === "connector.bootstrap.commit") {
      if (!this.observationalMemory || !this.config) throw new Error("memory_not_ready");
      const connectorId = String(params.connectorId ?? "notion").trim();
      const proof = this.connectorProofCache.get(connectorId);
      if (!proof) throw new Error(`connector_proof_not_found:${connectorId}`);
      const partitionGroupId = typeof params.groupId === "string" && params.groupId.trim()
        ? params.groupId.trim()
        : this.config.ontology.connectors[connectorId]?.workspaceName || "default";
      const partitionProjectId = typeof params.projectId === "string" && params.projectId.trim()
        ? params.projectId.trim()
        : this.config.ontology.connectors[connectorId]?.projectTags?.[0] || partitionGroupId;
      const partitionSessionKey = typeof params.sessionKey === "string" && params.sessionKey.trim()
        ? params.sessionKey.trim()
        : `group:${partitionGroupId}:main`;
      const commit = await commitProofToMemory(proof, this.observationalMemory, this.config, {
        projectId: partitionProjectId,
        groupId: partitionGroupId,
        sessionKey: partitionSessionKey,
      });
      return { ok: true, connectorId, ...commit };
    }

    if (method === "memory.observation.append") {
      if (!this.observationalMemory) throw new Error("memory_not_ready");
      const summary = String(params.summary ?? "").trim();
      if (!summary) throw new Error("memory_observation_summary_required");
      const source = String(params.source ?? "").trim();
      if (!source) throw new Error("memory_observation_source_required");
      const projectId = String(params.projectId ?? "").trim();
      if (!projectId) throw new Error("memory_observation_project_id_required");
      const groupId = String(params.groupId ?? "").trim();
      if (!groupId) throw new Error("memory_observation_group_id_required");
      const sessionKey = String(params.sessionKey ?? "").trim();
      if (!sessionKey) throw new Error("memory_observation_session_key_required");
      await this.observationalMemory.recordPollingRun(
        {
          ts: Date.now(),
          jobId: String(params.jobId ?? "manual.observation"),
          status: "ok",
          detail: "manual_observation_append",
          correlationId: typeof params.correlationId === "string" ? params.correlationId : undefined,
        },
        {
          projectId,
          groupId,
          sessionKey,
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
          category:
            params.category === "decision" ||
            params.category === "blocker_risk" ||
            params.category === "progress_delta" ||
            params.category === "commitment_shift" ||
            params.category === "opportunity"
              ? params.category
              : undefined,
          rationale: typeof params.rationale === "string" ? params.rationale : undefined,
          provenanceRefs: Array.isArray(params.provenanceRefs)
            ? params.provenanceRefs.filter((entry): entry is string => typeof entry === "string")
            : undefined,
          metadata: { via: "rpc", projectId, groupId, sessionKey },
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
