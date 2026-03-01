import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { fahrenheitConfigSchema, type FahrenheitConfig } from "./schema.js";
import { resolveSecretValue } from "../security/secrets.js";

function resolveGatewayHost(config: FahrenheitConfig): void {
  if (config.gateway.server.bind === "loopback") {
    config.gateway.server.host = "127.0.0.1";
    return;
  }
  if (config.gateway.server.bind === "lan") {
    config.gateway.server.host = "0.0.0.0";
    return;
  }
  if (config.gateway.server.bind === "custom" && config.gateway.server.customBindHost) {
    config.gateway.server.host = config.gateway.server.customBindHost;
  }
}

function assertGatewaySecurityDefaults(config: FahrenheitConfig): void {
  const isLoopback = config.gateway.server.host === "127.0.0.1" || config.gateway.server.host === "localhost";
  if (!isLoopback && !config.gateway.server.ingestToken) {
    throw new Error("gateway.server.ingestToken is required when gateway server bind is non-loopback");
  }
}

function expandHome(p: string): string {
  return p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p;
}

async function loadEnvFile(filePath: string): Promise<void> {
  if (!existsSync(filePath)) return;
  const content = await readFile(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const valueWithComment = line.slice(eq + 1).trim();
    const value = valueWithComment.includes(" #")
      ? valueWithComment.slice(0, valueWithComment.indexOf(" #")).trim()
      : valueWithComment;
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function loadProjectEnv(): Promise<void> {
  const cwd = process.cwd();
  await loadEnvFile(path.join(cwd, ".env.local"));
  await loadEnvFile(path.join(cwd, ".env"));
}

export function defaultConfigPath(): string {
  // MEM-0003 decision: Fahrenheit runtime/config defaults live under ~/.fahrenheit.
  return path.join(os.homedir(), ".fahrenheit", "fahrenheit.json");
}

function resolveConfigPath(configPath = defaultConfigPath()): string {
  return expandHome(configPath);
}

async function ensureConfigFile(absolutePath: string): Promise<void> {
  if (existsSync(absolutePath)) return;
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, JSON.stringify({}, null, 2), "utf8");
}

async function resolveConfigString(value: string | undefined, required: boolean, fieldPath: string): Promise<string | undefined> {
  if (!value) {
    if (required) throw new Error(`Missing required config value: ${fieldPath}`);
    return value;
  }
  if (value.startsWith("$") || value.startsWith("!")) {
    try {
      return await resolveSecretValue(value);
    } catch (error) {
      if (required) throw error;
      return value;
    }
  }
  return value;
}

async function resolveActiveSecrets(config: FahrenheitConfig): Promise<FahrenheitConfig> {
  if (config.gateway.channels.telegram.enabled) {
    config.gateway.channels.telegram.botToken = await resolveConfigString(
      config.gateway.channels.telegram.botToken,
      true,
      "gateway.channels.telegram.botToken",
    );
  }
  if (config.gateway.channels.discord.enabled) {
    config.gateway.channels.discord.token = await resolveConfigString(
      config.gateway.channels.discord.token,
      true,
      "gateway.channels.discord.token",
    );
  }
  if (config.gateway.channels.slack.enabled) {
    config.gateway.channels.slack.botToken = await resolveConfigString(
      config.gateway.channels.slack.botToken,
      true,
      "gateway.channels.slack.botToken",
    );
    config.gateway.channels.slack.appToken = await resolveConfigString(
      config.gateway.channels.slack.appToken,
      true,
      "gateway.channels.slack.appToken",
    );
  }

  if (config.gateway.channels.notion.enabled) {
    config.gateway.channels.notion.apiKey = await resolveConfigString(
      config.gateway.channels.notion.apiKey,
      true,
      "gateway.channels.notion.apiKey",
    );
    config.gateway.channels.notion.webhookVerificationToken = await resolveConfigString(
      config.gateway.channels.notion.webhookVerificationToken,
      false,
      "gateway.channels.notion.webhookVerificationToken",
    );
  }

  config.gateway.server.ingestToken = await resolveConfigString(
    config.gateway.server.ingestToken,
    false,
    "gateway.server.ingestToken",
  );

  if (config.runtime.ai.enabled) {
    for (const [providerId, providerConfig] of Object.entries(config.runtime.ai.providers)) {
      providerConfig.apiKey = await resolveConfigString(providerConfig.apiKey, false, `runtime.ai.providers.${providerId}.apiKey`);
      providerConfig.apiBase = await resolveConfigString(
        providerConfig.apiBase ?? undefined,
        false,
        `runtime.ai.providers.${providerId}.apiBase`,
      );
      if (providerConfig.extraHeaders) {
        for (const [headerKey, headerValue] of Object.entries(providerConfig.extraHeaders)) {
          providerConfig.extraHeaders[headerKey] = (await resolveConfigString(
            headerValue,
            false,
            `runtime.ai.providers.${providerId}.extraHeaders.${headerKey}`,
          )) as string;
        }
      }
    }
  }

  if (config.gateway.sink.type === "convex") {
    config.gateway.sink.convex = config.gateway.sink.convex ?? {};
    config.gateway.sink.convex.deploymentUrl = await resolveConfigString(
      config.gateway.sink.convex.deploymentUrl,
      true,
      "gateway.sink.convex.deploymentUrl",
    );
    config.gateway.sink.convex.authToken = await resolveConfigString(
      config.gateway.sink.convex.authToken,
      false,
      "gateway.sink.convex.authToken",
    );
  }
  if (config.gateway.sink.type === "file") {
    config.gateway.sink.filePath = await resolveConfigString(
      config.gateway.sink.filePath,
      false,
      "gateway.sink.filePath",
    );
  }

  if (config.gateway.logSink === "convex") {
    config.gateway.sink.convex = config.gateway.sink.convex ?? {};
    config.gateway.sink.convex.deploymentUrl = await resolveConfigString(
      config.gateway.sink.convex.deploymentUrl,
      true,
      "gateway.sink.convex.deploymentUrl",
    );
    config.gateway.sink.convex.authToken = await resolveConfigString(
      config.gateway.sink.convex.authToken,
      false,
      "gateway.sink.convex.authToken",
    );
  }

  const notionSource = config.ontology.connectors.notion;
  if (config.ontology.enabled && notionSource?.enabled) {
    notionSource.apiKey = await resolveConfigString(
      notionSource.apiKey,
      true,
      "ontology.connectors.notion.apiKey",
    );
  }

  resolveGatewayHost(config);
  assertGatewaySecurityDefaults(config);

  return config;
}

function assertNoLegacyConfigKeys(parsed: Record<string, unknown>): void {
  const legacyKeyHints: Array<{ path: string; replacement: string }> = [
    { path: "channels", replacement: "gateway.channels" },
    { path: "workspaceDir", replacement: "runtime.workspaceDir" },
    { path: "dataDir", replacement: "runtime.dataDir" },
    { path: "brain", replacement: "runtime.heartbeat/runtime.cron" },
    { path: "ai", replacement: "runtime.ai" },
    { path: "agents", replacement: "runtime.agent" },
    { path: "bindings", replacement: "gateway.groups" },
    { path: "session", replacement: "gateway.groups + routing" },
    { path: "eventSink", replacement: "gateway.sink" },
    { path: "logSink", replacement: "gateway.logSink" },
    { path: "convex", replacement: "gateway.sink.convex" },
    { path: "skills", replacement: "workspace-managed skills" },
    { path: "gateway.bridges", replacement: "gateway.groups + channels.custom" },
    { path: "ontology.sources", replacement: "ontology.connectors" },
  ];

  for (const hint of legacyKeyHints) {
    const keys = hint.path.split(".");
    let cursor: unknown = parsed;
    let exists = true;
    for (const key of keys) {
      if (!cursor || typeof cursor !== "object" || !(key in (cursor as Record<string, unknown>))) {
        exists = false;
        break;
      }
      cursor = (cursor as Record<string, unknown>)[key];
    }
    if (exists) {
      throw new Error(`Unsupported legacy config key "${hint.path}". Use "${hint.replacement}" instead.`);
    }
  }
}

export async function loadRawConfig(configPath = defaultConfigPath()): Promise<Record<string, unknown>> {
  await loadProjectEnv();
  const absolutePath = resolveConfigPath(configPath);
  await ensureConfigFile(absolutePath);
  const raw = await readFile(absolutePath, "utf8");
  const parsed = raw.trim() ? (JSON.parse(raw) as Record<string, unknown>) : {};
  assertNoLegacyConfigKeys(parsed);
  return parsed;
}

export async function saveRawConfig(rawConfig: Record<string, unknown>, configPath = defaultConfigPath()): Promise<string> {
  const absolutePath = resolveConfigPath(configPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(rawConfig, null, 2)}\n`, "utf8");
  return absolutePath;
}

export async function loadConfig(configPath = defaultConfigPath()): Promise<FahrenheitConfig> {
  await loadProjectEnv();
  const parsed = await loadRawConfig(configPath);
  const config = fahrenheitConfigSchema.parse(parsed);
  const resolvedConfig = await resolveActiveSecrets(config);
  if (resolvedConfig.gateway.channels.whatsapp.authDir) {
    resolvedConfig.gateway.channels.whatsapp.authDir = expandHome(resolvedConfig.gateway.channels.whatsapp.authDir);
  }
  if (resolvedConfig.runtime.cron.storePath) {
    resolvedConfig.runtime.cron.storePath = expandHome(resolvedConfig.runtime.cron.storePath);
  }
  if (resolvedConfig.runtime.cron.runsPath) {
    resolvedConfig.runtime.cron.runsPath = expandHome(resolvedConfig.runtime.cron.runsPath);
  }
  resolvedConfig.runtime.memory.compression.snapshotDir = expandHome(resolvedConfig.runtime.memory.compression.snapshotDir);
  if (resolvedConfig.gateway.sink.filePath) {
    resolvedConfig.gateway.sink.filePath = expandHome(resolvedConfig.gateway.sink.filePath);
  }
  return {
    ...resolvedConfig,
    runtime: {
      ...resolvedConfig.runtime,
      workspaceDir: expandHome(resolvedConfig.runtime.workspaceDir),
      dataDir: expandHome(resolvedConfig.runtime.dataDir),
    },
  };
}
