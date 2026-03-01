/**
 * SHELL COMPANY NOTION PLUGIN
 * ===========================
 * OpenClaw extension for Notion channel behavior and Notion helper RPCs.
 *
 * KEY CONCEPTS:
 * - Channel config is read from `channels.notion.accounts.<accountId>`.
 * - Plugin-level config is read from `plugins.entries.notion-shell.config`.
 * - Gateway helper methods provide UI-friendly Notion utilities.
 *
 * USAGE:
 * - Add this directory to `plugins.load.paths`.
 * - Enable plugin entry `notion-shell`.
 * - Configure `channels.notion.accounts.default.apiKey`.
 */
import { Client } from "@notionhq/client";

type Json = Record<string, unknown>;

type NotionAccountConfig = {
  apiKey?: string;
  pageIds?: string[];
  requireWakeWord?: boolean;
  wakeWords?: string[];
};

function normalizePageId(input: string): string | null {
  const compact = input.trim().replace(/-/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(compact)) return null;
  const value = compact.toLowerCase();
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function getAccount(cfg: Json, accountId: string): NotionAccountConfig {
  const channels = (cfg.channels ?? {}) as Json;
  const notion = (channels.notion ?? {}) as Json;
  const accounts = (notion.accounts ?? {}) as Json;
  const raw = (accounts[accountId] ?? {}) as Json;
  return {
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey : undefined,
    pageIds: Array.isArray(raw.pageIds) ? raw.pageIds.filter((v): v is string => typeof v === "string") : [],
    requireWakeWord: raw.requireWakeWord !== false,
    wakeWords: Array.isArray(raw.wakeWords) ? raw.wakeWords.filter((v): v is string => typeof v === "string") : ["@shell"],
  };
}

function hasWakeWord(content: string, cfg: NotionAccountConfig): boolean {
  if (!cfg.requireWakeWord) return true;
  const text = content.toLowerCase();
  const wakeWords = (cfg.wakeWords ?? []).map((w) => w.toLowerCase().trim()).filter(Boolean);
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
  const props = page?.properties ?? {};

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

export default function register(api: any): void {
  const pluginId = "notion-shell";

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
          const channels = (cfg.channels ?? {}) as Json;
          const notion = (channels.notion ?? {}) as Json;
          const accounts = (notion.accounts ?? {}) as Json;
          return Object.keys(accounts);
        },
        resolveAccount: (cfg: Json, accountId?: string) => getAccount(cfg, accountId ?? "default"),
      },
      outbound: {
        deliveryMode: "direct",
        sendText: async (ctx: { config: Json; accountId?: string; text?: string; peer?: { id?: string } }) => {
          const account = getAccount(ctx.config, ctx.accountId ?? "default");
          if (!account.apiKey) return { ok: false, error: "notion_api_key_missing" };
          const pageId = normalizePageId(String(ctx.peer?.id ?? ""));
          if (!pageId) return { ok: false, error: "notion_page_id_missing" };
          const client = new Client({ auth: account.apiKey });
          await client.comments.create({
            parent: { page_id: pageId },
            rich_text: [{ type: "text", text: { content: String(ctx.text ?? "") } }],
          } as never);
          return { ok: true };
        },
      },
      commands: {
        canHandle: (input: { text?: string; config: Json; accountId?: string }) => {
          const account = getAccount(input.config, input.accountId ?? "default");
          const body = String(input.text ?? "");
          return hasWakeWord(body, account);
        },
      },
    },
  });

  api.registerGatewayMethod(`${pluginId}.status.update`, async ({ params, config, respond }: any) => {
    try {
      const accountId = typeof params?.accountId === "string" ? params.accountId : "default";
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

  api.registerGatewayMethod(`${pluginId}.sources.list`, async ({ params, config, respond }: any) => {
    try {
      const accountId = typeof params?.accountId === "string" ? params.accountId : "default";
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
        .map((row: any) => ({
          id: String(row?.id ?? ""),
          title:
            (Array.isArray(row?.title) ? row.title.map((i: any) => String(i?.plain_text ?? "")).join("").trim() : "") ||
            "Untitled source",
          url: typeof row?.url === "string" ? row.url : "",
          objectType: typeof row?.object === "string" ? row.object : "data_source",
          lastEditedTime: typeof row?.last_edited_time === "string" ? row.last_edited_time : "",
        }))
        .filter((row: { id: string }) => row.id.length > 0)
        .sort((a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title));
      respond(true, { sources });
    } catch (error) {
      respond(false, { error: error instanceof Error ? error.message : "sources_list_failed" });
    }
  });
}
