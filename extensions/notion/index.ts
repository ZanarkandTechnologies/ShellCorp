/**
 * SHELL COMPANY NOTION PLUGIN
 * ===========================
 * OpenClaw extension for Notion channel behavior, webhook ingress, and Notion helper RPCs.
 *
 * KEY CONCEPTS:
 * - Channel config is read from `channels.notion.accounts.<accountId>`.
 * - Plugin-level config is read from `plugins.entries.notion-shell.config`.
 * - Accepted `comment.created` events proxy into OpenClaw `/hooks/agent`.
 *
 * USAGE:
 * - Add this directory to `plugins.load.paths`.
 * - Enable plugin entry `notion-shell`.
 * - Configure `channels.notion.accounts.default.apiKey`.
 *
 * MEMORY REFERENCES:
 * - MEM-0154
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { Client } from "@notionhq/client";
import {
  DEFAULT_ACCOUNT_ID,
  DEFAULT_NOTION_WEBHOOK_PATH,
  DEFAULT_OPENCLAW_HOOKS_PATH,
  DEFAULT_TARGET_AGENT_ID,
  handleNotionWebhook,
  type NotionWebhookAccountConfig,
} from "./webhook.js";

type Json = Record<string, unknown>;

type NotionTaskRow = {
  taskId: string;
  providerTaskId: string;
  title: string;
  status: "todo" | "in_progress" | "blocked" | "done";
  provider: "notion";
  canonicalProvider: "notion";
  providerUrl: string;
};

type GatewayMethodContext = {
  params?: Json;
  config: Json;
  respond: (ok: boolean, payload: Json) => void;
};

type PluginApi = {
  config?: Json;
  runtime?: {
    config?: {
      loadConfig?: () => Json | Promise<Json>;
      writeConfigFile?: (config: Json) => unknown | Promise<unknown>;
      writeConfig?: (config: Json) => unknown | Promise<unknown>;
    };
  };
  registerChannel: (definition: unknown) => void;
  registerHttpRoute?: (definition: {
    path: string;
    methods?: string[];
    auth?: string;
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
  }) => void;
  registerGatewayMethod: (
    name: string,
    handler: (context: GatewayMethodContext) => void | Promise<void>,
  ) => void;
};

const TASK_METHOD_DEPRECATION_NOTE =
  "Deprecated for active onboarding: prefer comments-first webhook flow + skills for task operations.";

function asObject(input: unknown): Json {
  return input && typeof input === "object" ? (input as Json) : {};
}

function normalizePageId(input: string): string | null {
  const compact = input.trim().replace(/-/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(compact)) return null;
  const value = compact.toLowerCase();
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function getAccount(cfg: Json, accountId: string): NotionWebhookAccountConfig {
  const channels = asObject(cfg.channels);
  const notion = asObject(channels.notion);
  const accounts = asObject(notion.accounts);
  const raw = asObject(accounts[accountId]);
  return {
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey : undefined,
    pageIds: Array.isArray(raw.pageIds)
      ? raw.pageIds.filter((value): value is string => typeof value === "string")
      : [],
    requireWakeWord: raw.requireWakeWord !== false,
    wakeWords: Array.isArray(raw.wakeWords)
      ? raw.wakeWords.filter((value): value is string => typeof value === "string")
      : ["@shell"],
  };
}

function getPluginConfig(cfg: Json): Json {
  const plugins = asObject(cfg.plugins);
  const entries = asObject(plugins.entries);
  const notionEntry = asObject(entries["notion-shell"]);
  return asObject(notionEntry.config);
}

function getWebhookConfig(cfg: Json): {
  path: string;
  targetAgentId: string;
  verificationToken?: string;
} {
  const pluginConfig = getPluginConfig(cfg);
  const webhook = asObject(pluginConfig.webhook);
  return {
    path:
      typeof webhook.path === "string" && webhook.path.trim()
        ? webhook.path.trim()
        : DEFAULT_NOTION_WEBHOOK_PATH,
    targetAgentId:
      typeof webhook.targetAgentId === "string" && webhook.targetAgentId.trim()
        ? webhook.targetAgentId.trim()
        : DEFAULT_TARGET_AGENT_ID,
    verificationToken:
      typeof webhook.verificationToken === "string" && webhook.verificationToken.trim()
        ? webhook.verificationToken.trim()
        : undefined,
  };
}

function hasWakeWord(content: string, cfg: NotionWebhookAccountConfig): boolean {
  if (cfg.requireWakeWord === false) return true;
  const text = content.toLowerCase();
  const wakeWords = (cfg.wakeWords ?? []).map((word) => word.toLowerCase().trim()).filter(Boolean);
  if (wakeWords.length === 0) return false;
  return wakeWords.some((word) => text.includes(word));
}

async function updatePageStatus(
  client: Client,
  pageId: string,
  nextStatus: string,
): Promise<{ ok: boolean; reason?: string }> {
  const normalized = normalizePageId(pageId);
  if (!normalized) return { ok: false, reason: "invalid_page_id" };

  const page = (await client.pages.retrieve({ page_id: normalized })) as unknown as {
    properties?: Record<string, { type?: string }>;
  };
  const props = page.properties ?? {};

  for (const [name, value] of Object.entries(props)) {
    if (!/status|state/i.test(name)) continue;
    if (value?.type === "status") {
      await client.pages.update({
        page_id: normalized,
        properties: { [name]: { status: { name: nextStatus } } } as never,
      });
      return { ok: true };
    }
    if (value?.type === "select") {
      await client.pages.update({
        page_id: normalized,
        properties: { [name]: { select: { name: nextStatus } } } as never,
      });
      return { ok: true };
    }
  }

  return { ok: false, reason: "status_property_not_found" };
}

function extractPageTitle(properties: Record<string, unknown>): string {
  for (const [name, value] of Object.entries(properties)) {
    if (!/title/i.test(name)) continue;
    const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const titleEntries = Array.isArray(row.title) ? row.title : [];
    const text = titleEntries
      .map((item) => {
        const chunk = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return typeof chunk.plain_text === "string" ? chunk.plain_text : "";
      })
      .join("")
      .trim();
    if (text) return text;
  }
  return "Untitled";
}

function extractStatusValue(properties: Record<string, unknown>): string {
  for (const [name, value] of Object.entries(properties)) {
    if (!/status|state/i.test(name)) continue;
    const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const statusObj =
      row.status && typeof row.status === "object" ? (row.status as Record<string, unknown>) : null;
    if (statusObj && typeof statusObj.name === "string" && statusObj.name.trim())
      return statusObj.name;
    const selectObj =
      row.select && typeof row.select === "object" ? (row.select as Record<string, unknown>) : null;
    if (selectObj && typeof selectObj.name === "string" && selectObj.name.trim())
      return selectObj.name;
  }
  return "To Do";
}

function normalizeTaskStatus(input: string): "todo" | "in_progress" | "blocked" | "done" {
  const value = input.toLowerCase().trim();
  if (value.includes("progress") || value === "doing") return "in_progress";
  if (value.includes("block")) return "blocked";
  if (value.includes("done") || value.includes("complete")) return "done";
  return "todo";
}

function toNotionStatus(input: "todo" | "in_progress" | "blocked" | "done"): string {
  if (input === "in_progress") return "In Progress";
  if (input === "blocked") return "Blocked";
  if (input === "done") return "Done";
  return "To Do";
}

async function listDatabaseTasks(
  client: Client,
  dataSourceId: string,
): Promise<Array<Record<string, unknown>>> {
  const response = (await client.dataSources.query({
    data_source_id: dataSourceId,
    page_size: 100,
  })) as unknown as { results?: Array<Record<string, unknown>> };
  const rows = Array.isArray(response.results) ? response.results : [];
  return rows
    .map((row): NotionTaskRow | null => {
      const id = typeof row.id === "string" ? row.id : "";
      const url = typeof row.url === "string" ? row.url : "";
      const properties =
        row.properties && typeof row.properties === "object"
          ? (row.properties as Record<string, unknown>)
          : {};
      const title = extractPageTitle(properties);
      const status = normalizeTaskStatus(extractStatusValue(properties));
      if (!id) return null;
      return {
        taskId: id,
        providerTaskId: id,
        title,
        status,
        provider: "notion",
        canonicalProvider: "notion",
        providerUrl: url,
      };
    })
    .filter((row): row is NotionTaskRow => row !== null);
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function writeJsonResponse(res: ServerResponse, statusCode: number, payload: Json): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

async function loadRuntimeConfig(api: PluginApi): Promise<Json> {
  const loadConfig = api?.runtime?.config?.loadConfig;
  if (typeof loadConfig === "function") {
    const loaded = await Promise.resolve(loadConfig());
    return asObject(loaded);
  }
  return asObject(api?.config);
}

async function persistVerificationToken(api: PluginApi, token: string): Promise<boolean> {
  const writeConfig = api?.runtime?.config?.writeConfigFile ?? api?.runtime?.config?.writeConfig;
  if (typeof writeConfig !== "function") return false;

  const current = await loadRuntimeConfig(api);
  const plugins = asObject(current.plugins);
  const entries = asObject(plugins.entries);
  const notionEntry = asObject(entries["notion-shell"]);
  const pluginConfig = asObject(notionEntry.config);
  const webhook = asObject(pluginConfig.webhook);

  if (
    typeof webhook.verificationToken === "string" &&
    webhook.verificationToken.trim() === token.trim()
  ) {
    return true;
  }

  const nextConfig: Json = {
    ...current,
    plugins: {
      ...plugins,
      entries: {
        ...entries,
        "notion-shell": {
          ...notionEntry,
          config: {
            ...pluginConfig,
            webhook: {
              ...webhook,
              path:
                typeof webhook.path === "string" && webhook.path.trim()
                  ? webhook.path.trim()
                  : DEFAULT_NOTION_WEBHOOK_PATH,
              targetAgentId:
                typeof webhook.targetAgentId === "string" && webhook.targetAgentId.trim()
                  ? webhook.targetAgentId.trim()
                  : DEFAULT_TARGET_AGENT_ID,
              verificationToken: token.trim(),
            },
          },
        },
      },
    },
  };

  await Promise.resolve(writeConfig(nextConfig));
  return true;
}

function lowerCaseHeaders(headers: IncomingMessage["headers"]): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      normalized[name.toLowerCase()] = value.join(", ");
      continue;
    }
    normalized[name.toLowerCase()] = typeof value === "string" ? value : undefined;
  }
  return normalized;
}

export default function register(api: PluginApi): void {
  const pluginId = "notion-shell";
  const initialWebhookPath = getWebhookConfig(asObject(api.config)).path;

  api.registerChannel({
    plugin: {
      id: "notion",
      meta: {
        id: "notion",
        label: "Notion",
        selectionLabel: "Notion Comments",
        docsPath: "/channels/notion",
        blurb: "Notion comments bridge for Shell Company workflows.",
        aliases: ["notion-comments"],
      },
      capabilities: { chatTypes: ["group", "direct"] },
      config: {
        listAccountIds: (cfg: Json) => {
          const channels = asObject(cfg.channels);
          const notion = asObject(channels.notion);
          const accounts = asObject(notion.accounts);
          return Object.keys(accounts);
        },
        resolveAccount: (cfg: Json, accountId?: string) =>
          getAccount(cfg, accountId ?? DEFAULT_ACCOUNT_ID),
      },
      outbound: {
        deliveryMode: "direct",
        sendText: async (ctx: {
          config: Json;
          accountId?: string;
          text?: string;
          peer?: { id?: string };
        }) => {
          const account = getAccount(ctx.config, ctx.accountId ?? DEFAULT_ACCOUNT_ID);
          if (!account.apiKey) return { ok: false, error: "notion_api_key_missing" };
          const pageId = normalizePageId(String(ctx.peer?.id ?? ""));
          if (!pageId) return { ok: false, error: "notion_page_id_missing" };
          const client = new Client({ auth: account.apiKey });
          await client.comments.create({
            parent: { page_id: pageId },
            rich_text: [{ type: "text", text: { content: String(ctx.text ?? "") } }],
          });
          return { ok: true };
        },
      },
      commands: {
        canHandle: (input: { text?: string; config: Json; accountId?: string }) => {
          const account = getAccount(input.config, input.accountId ?? DEFAULT_ACCOUNT_ID);
          return hasWakeWord(String(input.text ?? ""), account);
        },
      },
    },
  });

  if (typeof api.registerHttpRoute === "function") {
    api.registerHttpRoute({
      path: initialWebhookPath,
      methods: ["POST"],
      auth: "plugin",
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const rawBody = await readRequestBody(req);
          const parsed = JSON.parse(rawBody) as unknown;
          const payload = parsed && typeof parsed === "object" ? (parsed as Json) : null;
          if (!payload) {
            writeJsonResponse(res, 400, { ok: false, error: "invalid_json_body" });
            return;
          }

          const runtimeConfig = await loadRuntimeConfig(api);
          const webhookConfig = getWebhookConfig(runtimeConfig);
          const pluginConfig = getPluginConfig(runtimeConfig);
          const defaultAccountId =
            typeof pluginConfig.defaultAccountId === "string" &&
            pluginConfig.defaultAccountId.trim()
              ? pluginConfig.defaultAccountId.trim()
              : DEFAULT_ACCOUNT_ID;
          const hooks = asObject(runtimeConfig.hooks);
          const result = await handleNotionWebhook({
            rawBody,
            payload,
            headers: lowerCaseHeaders(req.headers),
            localPort: req.socket.localPort,
            config: {
              verificationToken: webhookConfig.verificationToken,
              targetAgentId: webhookConfig.targetAgentId,
              hooksPath:
                typeof hooks.path === "string" && hooks.path.trim()
                  ? hooks.path.trim()
                  : DEFAULT_OPENCLAW_HOOKS_PATH,
              hooksToken:
                typeof hooks.token === "string" && hooks.token.trim()
                  ? hooks.token.trim()
                  : undefined,
              account: getAccount(runtimeConfig, defaultAccountId),
            },
            fetchImpl: fetch,
            retrieveComment: async ({ apiKey, commentId }) => {
              const client = new Client({ auth: apiKey });
              return client.comments.retrieve({ comment_id: commentId });
            },
            persistVerificationToken: async (token) => persistVerificationToken(api, token),
          });
          writeJsonResponse(res, result.statusCode, result.body);
        } catch (error) {
          writeJsonResponse(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : "notion_webhook_failed",
          });
        }
      },
    });
  } else {
    console.warn("[notion-shell] registerHttpRoute unavailable; webhook ingress not installed");
  }

  api.registerGatewayMethod(`${pluginId}.status.update`, async (context: GatewayMethodContext) => {
    const { params, config, respond } = context;
    try {
      const accountId =
        typeof params?.accountId === "string" ? params.accountId : DEFAULT_ACCOUNT_ID;
      const account = getAccount(config as Json, accountId);
      if (!account.apiKey) {
        respond(false, { error: "notion_api_key_missing" });
        return;
      }
      const pageId = String(params?.pageId ?? "");
      const status = String(params?.status ?? "");
      if (!pageId || !status) {
        respond(false, { error: "page_id_and_status_required" });
        return;
      }
      const client = new Client({ auth: account.apiKey });
      const result = await updatePageStatus(client, pageId, status);
      respond(result.ok, result.ok ? { ok: true } : { ok: false, reason: result.reason });
    } catch (error) {
      respond(false, { error: error instanceof Error ? error.message : "status_update_failed" });
    }
  });

  api.registerGatewayMethod(`${pluginId}.sources.list`, async (context: GatewayMethodContext) => {
    const { params, config, respond } = context;
    try {
      const accountId =
        typeof params?.accountId === "string" ? params.accountId : DEFAULT_ACCOUNT_ID;
      const account = getAccount(config as Json, accountId);
      if (!account.apiKey) {
        respond(false, { error: "notion_api_key_missing" });
        return;
      }
      const client = new Client({ auth: account.apiKey });
      const raw = await client.search({
        page_size: 100,
        filter: { property: "object", value: "data_source" },
      } as never);
      const sources = (raw.results ?? [])
        .map((row: unknown) => {
          const item = asObject(row);
          return {
            id: String(item.id ?? ""),
            title:
              (Array.isArray(item.title)
                ? item.title
                    .map((entry) => String(asObject(entry).plain_text ?? ""))
                    .join("")
                    .trim()
                : "") || "Untitled source",
            url: typeof item.url === "string" ? item.url : "",
            objectType: typeof item.object === "string" ? item.object : "data_source",
            lastEditedTime: typeof item.last_edited_time === "string" ? item.last_edited_time : "",
          };
        })
        .filter((row) => row.id.length > 0)
        .sort((a, b) => a.title.localeCompare(b.title));
      respond(true, { sources });
    } catch (error) {
      respond(false, { error: error instanceof Error ? error.message : "sources_list_failed" });
    }
  });

  api.registerGatewayMethod(`${pluginId}.tasks.list`, async (context: GatewayMethodContext) => {
    const { params, config, respond } = context;
    try {
      const accountId =
        typeof params?.accountId === "string" ? params.accountId : DEFAULT_ACCOUNT_ID;
      const databaseId = String(params?.databaseId ?? "").trim();
      if (!databaseId) {
        respond(false, { error: "database_id_required" });
        return;
      }
      const account = getAccount(config as Json, accountId);
      if (!account.apiKey) {
        respond(false, { error: "notion_api_key_missing" });
        return;
      }
      const client = new Client({ auth: account.apiKey });
      const tasks = await listDatabaseTasks(client, databaseId);
      respond(true, {
        tasks,
        provider: "notion",
        databaseId,
        deprecated: true,
        deprecationNote: TASK_METHOD_DEPRECATION_NOTE,
      });
    } catch (error) {
      respond(false, { error: error instanceof Error ? error.message : "tasks_list_failed" });
    }
  });

  api.registerGatewayMethod(`${pluginId}.tasks.create`, async (context: GatewayMethodContext) => {
    const { params, config, respond } = context;
    try {
      const accountId =
        typeof params?.accountId === "string" ? params.accountId : DEFAULT_ACCOUNT_ID;
      const databaseId = String(params?.databaseId ?? "").trim();
      const title = String(params?.title ?? "").trim();
      const status = normalizeTaskStatus(String(params?.status ?? "todo"));
      if (!databaseId || !title) {
        respond(false, { error: "database_id_and_title_required" });
        return;
      }
      const account = getAccount(config as Json, accountId);
      if (!account.apiKey) {
        respond(false, { error: "notion_api_key_missing" });
        return;
      }
      const client = new Client({ auth: account.apiKey });
      const created = (await client.pages.create({
        parent: { data_source_id: databaseId },
        properties: {
          Name: {
            title: [
              {
                type: "text",
                text: { content: title },
              },
            ],
          },
          Status: {
            status: { name: toNotionStatus(status) },
          },
        },
      } as never)) as unknown as { id?: string; url?: string };
      respond(true, {
        task: {
          taskId: String(created.id ?? ""),
          providerTaskId: String(created.id ?? ""),
          title,
          status,
          provider: "notion",
          canonicalProvider: "notion",
          providerUrl: String(created.url ?? ""),
        },
        deprecated: true,
        deprecationNote: TASK_METHOD_DEPRECATION_NOTE,
      });
    } catch (error) {
      respond(false, { error: error instanceof Error ? error.message : "task_create_failed" });
    }
  });

  api.registerGatewayMethod(`${pluginId}.tasks.update`, async (context: GatewayMethodContext) => {
    const { params, config, respond } = context;
    try {
      const accountId =
        typeof params?.accountId === "string" ? params.accountId : DEFAULT_ACCOUNT_ID;
      const taskId = String(params?.taskId ?? params?.pageId ?? "").trim();
      const updates = asObject(params?.updates);
      const status =
        typeof updates.status === "string" ? normalizeTaskStatus(updates.status) : undefined;
      if (!taskId) {
        respond(false, { error: "task_id_required" });
        return;
      }
      const account = getAccount(config as Json, accountId);
      if (!account.apiKey) {
        respond(false, { error: "notion_api_key_missing" });
        return;
      }
      const client = new Client({ auth: account.apiKey });
      if (status) {
        const result = await updatePageStatus(client, taskId, toNotionStatus(status));
        if (!result.ok) {
          respond(false, { error: result.reason ?? "task_update_failed" });
          return;
        }
      }
      respond(true, {
        ok: true,
        taskId,
        deprecated: true,
        deprecationNote: TASK_METHOD_DEPRECATION_NOTE,
      });
    } catch (error) {
      respond(false, { error: error instanceof Error ? error.message : "task_update_failed" });
    }
  });

  api.registerGatewayMethod(`${pluginId}.tasks.sync`, async (context: GatewayMethodContext) => {
    const { params, config, respond } = context;
    try {
      const accountId =
        typeof params?.accountId === "string" ? params.accountId : DEFAULT_ACCOUNT_ID;
      const databaseId = String(params?.databaseId ?? "").trim();
      if (!databaseId) {
        respond(true, {
          ok: true,
          synced: 0,
          reason: "database_id_missing_skip",
          deprecated: true,
          deprecationNote: TASK_METHOD_DEPRECATION_NOTE,
        });
        return;
      }
      const account = getAccount(config as Json, accountId);
      if (!account.apiKey) {
        respond(false, { error: "notion_api_key_missing" });
        return;
      }
      const client = new Client({ auth: account.apiKey });
      const tasks = await listDatabaseTasks(client, databaseId);
      respond(true, {
        ok: true,
        synced: tasks.length,
        tasks,
        deprecated: true,
        deprecationNote: TASK_METHOD_DEPRECATION_NOTE,
      });
    } catch (error) {
      respond(false, { error: error instanceof Error ? error.message : "task_sync_failed" });
    }
  });

  api.registerGatewayMethod(
    `${pluginId}.profile.bootstrap`,
    async (context: GatewayMethodContext) => {
      const { params, config, respond } = context;
      try {
        const accountId =
          typeof params?.accountId === "string" ? params.accountId : DEFAULT_ACCOUNT_ID;
        const databaseId = String(params?.databaseId ?? "").trim();
        if (!databaseId) {
          respond(false, { error: "database_id_required" });
          return;
        }
        const account = getAccount(config as Json, accountId);
        if (!account.apiKey) {
          respond(false, { error: "notion_api_key_missing" });
          return;
        }
        const client = new Client({ auth: account.apiKey });
        const dataSource = (await client.dataSources.retrieve({
          data_source_id: databaseId,
        })) as unknown as {
          name?: string;
          properties?: Record<
            string,
            {
              type?: string;
              select?: { options?: Array<{ name?: string }> };
              status?: { options?: Array<{ name?: string }> };
            }
          >;
        };
        const fields = Object.entries(dataSource.properties ?? {}).map(([name, value]) => ({
          name,
          type: String(value?.type ?? "unknown"),
          options: Array.isArray(value?.select?.options)
            ? value.select.options.map((option) => String(option.name ?? "")).filter(Boolean)
            : Array.isArray(value?.status?.options)
              ? value.status.options.map((option) => String(option.name ?? "")).filter(Boolean)
              : undefined,
        }));
        respond(true, {
          profile: {
            provider: "notion",
            entityId: databaseId,
            entityName:
              typeof dataSource.name === "string" && dataSource.name.trim()
                ? dataSource.name.trim()
                : databaseId,
            fieldMappings: fields,
          },
        });
      } catch (error) {
        respond(false, {
          error: error instanceof Error ? error.message : "profile_bootstrap_failed",
        });
      }
    },
  );
}
