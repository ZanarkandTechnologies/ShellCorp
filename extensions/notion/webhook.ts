/**
 * NOTION WEBHOOK RUNTIME
 * ======================
 * Purpose
 * - Validate Notion webhook payloads and forward accepted comments into OpenClaw hooks.
 *
 * KEY CONCEPTS:
 * - Verification challenges are persisted into plugin config so later event signatures can be checked.
 * - `comment.created` payloads are metadata-first; comment text is retrieved via the Notion API.
 * - Accepted comments proxy into `/hooks/agent` with deterministic `hook:notion:` session keys.
 *
 * USAGE:
 * - Register the stable plugin route at `/plugins/notion-shell/webhook`.
 * - Call `handleNotionWebhook(...)` from the route handler.
 *
 * MEMORY REFERENCES:
 * - MEM-0154
 */
import { createHmac, timingSafeEqual } from "node:crypto";

type Json = Record<string, unknown>;

export const DEFAULT_NOTION_WEBHOOK_PATH = "/plugins/notion-shell/webhook";
export const DEFAULT_OPENCLAW_HOOKS_PATH = "/hooks";
export const DEFAULT_TARGET_AGENT_ID = "main";
export const DEFAULT_ACCOUNT_ID = "default";
export const DEFAULT_WAKE_WORD = "@shell";

export type NotionWebhookAccountConfig = {
  apiKey?: string;
  pageIds?: string[];
  requireWakeWord?: boolean;
  wakeWords?: string[];
};

export type NotionWebhookRuntimeConfig = {
  verificationToken?: string;
  targetAgentId?: string;
  hooksPath?: string;
  hooksToken?: string;
  account: NotionWebhookAccountConfig;
};

export type NotionWebhookHandlerInput = {
  rawBody: string;
  payload: Json;
  headers: Record<string, string | undefined>;
  localPort?: number;
  config: NotionWebhookRuntimeConfig;
  fetchImpl: typeof fetch;
  retrieveComment: (input: { apiKey: string; commentId: string }) => Promise<unknown>;
  persistVerificationToken: (token: string) => Promise<boolean>;
};

export type NotionWebhookHandlerResult = {
  statusCode: number;
  body: Json;
};

type NormalizedWebhookPayload = {
  verificationToken?: string;
  type?: string;
  pageId?: string;
  commentId?: string;
  botAuthored: boolean;
};

function toJsonObject(input: unknown): Json {
  return input && typeof input === "object" ? (input as Json) : {};
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function normalizeNotionComparableId(input: string | undefined): string {
  return (input ?? "").trim().replace(/-/g, "").toLowerCase();
}

export function hasWakeWord(content: string, cfg: NotionWebhookAccountConfig): boolean {
  if (cfg.requireWakeWord === false) return true;
  const text = content.toLowerCase();
  const wakeWords = (cfg.wakeWords ?? [DEFAULT_WAKE_WORD])
    .map((word) => word.toLowerCase().trim())
    .filter(Boolean);
  if (wakeWords.length === 0) return false;
  return wakeWords.some((word) => text.includes(word));
}

export function extractPlainText(richText: unknown): string {
  if (!Array.isArray(richText)) return "";
  return richText
    .map((entry) => {
      const row = toJsonObject(entry);
      return typeof row.plain_text === "string" ? row.plain_text : "";
    })
    .join("")
    .trim();
}

export function normalizeWebhookPayload(payload: Json): NormalizedWebhookPayload {
  const data = toJsonObject(payload.data);
  const entity = toJsonObject(payload.entity);
  const parent = toJsonObject(data.parent);
  const authors = Array.isArray(payload.authors) ? payload.authors : [];
  const botAuthored = authors.some((entry) => {
    const row = toJsonObject(entry);
    return (
      String(row.type ?? "")
        .trim()
        .toLowerCase() === "bot"
    );
  });

  return {
    verificationToken: firstString(payload.verification_token),
    type: firstString(payload.type),
    commentId: firstString(entity.id, payload.id),
    pageId: firstString(data.page_id, parent.type === "page" ? parent.id : undefined),
    botAuthored,
  };
}

export function isValidNotionSignature(input: {
  rawBody: string;
  signatureHeader?: string;
  verificationToken?: string;
}): boolean {
  const signatureHeader = input.signatureHeader?.trim();
  const verificationToken = input.verificationToken?.trim();
  if (!signatureHeader || !verificationToken) return false;

  const calculated = `sha256=${createHmac("sha256", verificationToken).update(input.rawBody).digest("hex")}`;
  const actualBuffer = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(calculated);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function buildAgentHookPayload(input: {
  message: string;
  agentId?: string;
  pageId: string;
  commentId: string;
}): Json {
  return {
    message: input.message,
    name: "Notion",
    agentId: input.agentId?.trim() || DEFAULT_TARGET_AGENT_ID,
    sessionKey: `hook:notion:page:${input.pageId}:comment:${input.commentId}`,
    wakeMode: "now",
    deliver: true,
    channel: "last",
  };
}

export function buildAgentHookUrl(input: { localPort?: number; hooksPath?: string }): string {
  const hooksPath = (input.hooksPath?.trim() || DEFAULT_OPENCLAW_HOOKS_PATH).replace(/\/+$/, "");
  const localPort = Number(input.localPort) > 0 ? Number(input.localPort) : 18789;
  return `http://127.0.0.1:${localPort}${hooksPath}/agent`;
}

export async function handleNotionWebhook(
  input: NotionWebhookHandlerInput,
): Promise<NotionWebhookHandlerResult> {
  const normalized = normalizeWebhookPayload(input.payload);

  if (normalized.verificationToken) {
    const persisted = await input.persistVerificationToken(normalized.verificationToken);
    return {
      statusCode: 200,
      body: {
        ok: true,
        verificationTokenSeen: true,
        persisted,
      },
    };
  }

  if (
    !isValidNotionSignature({
      rawBody: input.rawBody,
      signatureHeader: input.headers["x-notion-signature"],
      verificationToken: input.config.verificationToken,
    })
  ) {
    return {
      statusCode: 401,
      body: {
        ok: false,
        error: "invalid_signature",
      },
    };
  }

  if (normalized.type !== "comment.created") {
    return {
      statusCode: 202,
      body: {
        ok: true,
        skipped: true,
        reason: "unsupported_event",
        eventType: normalized.type ?? "",
      },
    };
  }

  if (normalized.botAuthored) {
    return {
      statusCode: 202,
      body: {
        ok: true,
        skipped: true,
        reason: "bot_authored",
      },
    };
  }

  if (!normalized.commentId || !normalized.pageId) {
    return {
      statusCode: 400,
      body: {
        ok: false,
        error: "invalid_payload",
      },
    };
  }

  const allowedPageIds = input.config.account.pageIds ?? [];
  if (
    allowedPageIds.length > 0 &&
    !allowedPageIds.some(
      (pageId) =>
        normalizeNotionComparableId(pageId) === normalizeNotionComparableId(normalized.pageId),
    )
  ) {
    return {
      statusCode: 202,
      body: {
        ok: true,
        skipped: true,
        reason: "page_not_allowed",
      },
    };
  }

  const apiKey = input.config.account.apiKey?.trim();
  if (!apiKey) {
    return {
      statusCode: 503,
      body: {
        ok: false,
        error: "notion_api_key_missing",
      },
    };
  }

  const comment = toJsonObject(
    await input.retrieveComment({
      apiKey,
      commentId: normalized.commentId,
    }),
  );
  const message = extractPlainText(comment.rich_text);
  if (!message) {
    return {
      statusCode: 202,
      body: {
        ok: true,
        skipped: true,
        reason: "empty_comment",
      },
    };
  }

  if (!hasWakeWord(message, input.config.account)) {
    return {
      statusCode: 202,
      body: {
        ok: true,
        skipped: true,
        reason: "wake_word_missing",
      },
    };
  }

  const hooksToken = input.config.hooksToken?.trim();
  if (!hooksToken) {
    return {
      statusCode: 503,
      body: {
        ok: false,
        error: "hooks_token_missing",
      },
    };
  }

  const hookPayload = buildAgentHookPayload({
    message,
    agentId: input.config.targetAgentId,
    pageId: normalized.pageId,
    commentId: normalized.commentId,
  });
  const hookUrl = buildAgentHookUrl({
    localPort: input.localPort,
    hooksPath: input.config.hooksPath,
  });
  const response = await input.fetchImpl(hookUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${hooksToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(hookPayload),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      statusCode: 502,
      body: {
        ok: false,
        error: "agent_dispatch_failed",
        status: response.status,
        detail: detail.slice(0, 240),
      },
    };
  }

  return {
    statusCode: 202,
    body: {
      ok: true,
      dispatched: true,
      agentId: String(hookPayload.agentId),
      sessionKey: String(hookPayload.sessionKey),
    },
  };
}
