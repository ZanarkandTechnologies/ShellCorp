import { Client } from "@notionhq/client";
import { createHmac, timingSafeEqual } from "node:crypto";

import type { BaseChannel, ProviderSetupSpec, ProviderStatus } from "./base.js";
import type { InboundEnvelope, OutboundEnvelope } from "../types.js";
import { formatLogLine, sanitizeInline } from "../logging/pretty.js";

interface NotionCommentsChannelOptions {
  apiKey: string;
  pageIds: string[];
  pollIntervalMs: number;
  webhookEnabled: boolean;
  webhookVerificationToken?: string;
  requireWakeWord: boolean;
  wakeWords: string[];
}

function normalizeNotionPageId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const hex32 = trimmed.match(/[0-9a-fA-F]{32}/)?.[0];
  if (!hex32) return null;
  const value = hex32.toLowerCase();
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function matchesWakeWord(content: string, wakeWords: string[], requireWakeWord: boolean): boolean {
  if (!requireWakeWord) return true;
  const normalizedWakeWords = wakeWords.map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0);
  if (normalizedWakeWords.length === 0) return false;
  const normalized = content.toLowerCase();
  return normalizedWakeWords.some((wakeWord) => normalized.includes(wakeWord));
}

export class NotionCommentsChannel implements BaseChannel {
  readonly id = "notion";
  private inboundHandler: ((envelope: InboundEnvelope) => Promise<void>) | null = null;
  private readonly client: Client;
  private readonly pageIds: string[];
  private readonly pollIntervalMs: number;
  private readonly webhookEnabled: boolean;
  private readonly webhookVerificationToken?: string;
  private readonly requireWakeWord: boolean;
  private readonly wakeWords: string[];
  private connected = false;
  private lastError: string | undefined;
  private pollTimer: NodeJS.Timeout | null = null;
  private readonly seenCommentIds = new Set<string>();

  constructor(options: NotionCommentsChannelOptions) {
    this.client = new Client({ auth: options.apiKey });
    this.pageIds = options.pageIds.map(normalizeNotionPageId).filter((value): value is string => Boolean(value));
    this.pollIntervalMs = options.pollIntervalMs;
    this.webhookEnabled = options.webhookEnabled;
    this.webhookVerificationToken = options.webhookVerificationToken;
    this.requireWakeWord = options.requireWakeWord;
    this.wakeWords = options.wakeWords
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry, index, self) => entry.length > 0 && self.indexOf(entry) === index);
  }

  setInboundHandler(handler: (envelope: InboundEnvelope) => Promise<void>): void {
    this.inboundHandler = handler;
  }

  async start(): Promise<void> {
    if (this.pageIds.length === 0 && !this.webhookEnabled) {
      this.connected = false;
      this.lastError = "notion_page_ids_required_or_invalid_without_webhook";
      return;
    }
    this.connected = true;
    this.lastError = undefined;
    if (this.pageIds.length > 0) {
      await this.pollOnce();
      this.pollTimer = setInterval(() => {
        void this.pollOnce();
      }, this.pollIntervalMs);
    }
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.connected = false;
  }

  async send(envelope: OutboundEnvelope): Promise<void> {
    const client = this.client as any;
    await client.comments.create({
      parent: { page_id: envelope.sourceId },
      rich_text: [
        {
          type: "text",
          text: {
            content: envelope.content,
          },
        },
      ],
    });
  }

  getSetupSpec(): ProviderSetupSpec {
    return {
      providerId: this.id,
      title: "Notion Comments",
      summary: "Poll comments on configured Notion pages and reply via comments API.",
      fields: [
        { key: "gateway.channels.notion.enabled", label: "Enable channel", required: true, example: "true" },
        { key: "gateway.channels.notion.apiKey", label: "Notion API key", required: true, secret: true },
        { key: "gateway.channels.notion.pageIds", label: "Page IDs (optional with webhook)", required: false, example: "[\"<page-id>\"]" },
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

  getStatus(): ProviderStatus {
    return {
      providerId: this.id,
      enabled: true,
      connected: this.connected,
      mode: "native",
      lastError: this.lastError,
    };
  }

  private async pollOnce(): Promise<void> {
    if (!this.inboundHandler) return;
    const client = this.client as any;
    try {
      for (const pageId of this.pageIds) {
        const response = await client.comments.list({ block_id: pageId });
        const comments = Array.isArray(response?.results) ? response.results : [];
        for (const comment of comments) {
          const commentId = String(comment.id ?? "");
          if (!commentId || this.seenCommentIds.has(commentId)) continue;
          this.seenCommentIds.add(commentId);
          const rich = Array.isArray(comment.rich_text) ? comment.rich_text : [];
          const content = rich
            .map((item: any) => item?.plain_text ?? item?.text?.content ?? "")
            .join("")
            .trim();
          if (!content) continue;
          if (!this.shouldRespondToContent(content)) {
            console.info("[notion] event=ignored reason=no_wake_word source=poll");
            continue;
          }
          const sender = comment.created_by?.id ? String(comment.created_by.id) : "notion-user";
          console.info(
            formatLogLine("notion", "inbound", {
              source: "poll",
              sourceId: pageId,
              senderId: sender,
              content: sanitizeInline(content),
            }),
          );
          await this.inboundHandler({
            channelId: this.id,
            sourceId: pageId,
            senderId: sender,
            senderName: sender,
            content,
            timestamp: Date.now(),
            isGroup: true,
            mode: "conversational",
            raw: {
              commentId,
              pageId,
            },
          });
        }
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "notion_poll_failed";
    }
  }

  async handleWebhook(rawBody: string, signatureHeader: string | undefined, payload: unknown): Promise<{
    accepted: boolean;
    verificationToken?: string;
    reason?: string;
  }> {
    if (!this.webhookEnabled) {
      return { accepted: false, reason: "webhook_disabled" };
    }
    if (!this.inboundHandler) {
      return { accepted: false, reason: "inbound_handler_not_ready" };
    }
    const body = typeof payload === "object" && payload ? (payload as Record<string, unknown>) : {};
    const verificationToken = typeof body.verification_token === "string" ? body.verification_token : undefined;
    if (verificationToken) {
      console.info("[notion] event=webhook_verification received=true");
      return { accepted: true, verificationToken };
    }

    if (this.webhookVerificationToken) {
      if (!signatureHeader) {
        return { accepted: false, reason: "missing_signature" };
      }
      const expected = `sha256=${createHmac("sha256", this.webhookVerificationToken).update(rawBody).digest("hex")}`;
      const left = Buffer.from(expected);
      const right = Buffer.from(signatureHeader);
      if (left.length !== right.length || !timingSafeEqual(left, right)) {
        return { accepted: false, reason: "invalid_signature" };
      }
    }

    const eventType = typeof body.type === "string" ? body.type : "";
    if (eventType !== "comment.created") {
      console.info(`[notion] event=ignored reason=unsupported_event type=${eventType || "unknown"}`);
      return { accepted: true, reason: `ignored_event_type:${eventType || "unknown"}` };
    }

    const authors = Array.isArray(body.authors) ? body.authors : [];
    if (authors.some((entry) => typeof entry === "object" && entry && (entry as { type?: string }).type === "bot")) {
      console.info("[notion] event=ignored reason=bot_comment source=webhook");
      return { accepted: true, reason: "ignored_bot_comment" };
    }

    const eventId = typeof body.id === "string" ? body.id : undefined;
    const entity = typeof body.entity === "object" && body.entity ? (body.entity as Record<string, unknown>) : {};
    const data = typeof body.data === "object" && body.data ? (body.data as Record<string, unknown>) : {};
    const commentId = typeof entity.id === "string" ? entity.id : "";
    const pageId = typeof data.page_id === "string" ? data.page_id : "";
    if (!commentId || !pageId) {
      console.info("[notion] event=ignored reason=missing_ids source=webhook");
      return { accepted: false, reason: "comment_event_missing_ids" };
    }
    if (this.seenCommentIds.has(commentId)) {
      console.info("[notion] event=ignored reason=duplicate_comment source=webhook");
      return { accepted: true, reason: "duplicate_comment_event" };
    }
    this.seenCommentIds.add(commentId);

    try {
      const client = this.client as unknown as {
        comments: { retrieve: (args: { comment_id: string }) => Promise<Record<string, unknown>> };
      };
      const comment = await client.comments.retrieve({ comment_id: commentId });
      const rich = Array.isArray(comment.rich_text) ? comment.rich_text : [];
      const content = rich
        .map((item) => {
          if (typeof item !== "object" || !item) return "";
          const value = item as { plain_text?: unknown; text?: { content?: unknown } };
          if (typeof value.plain_text === "string") return value.plain_text;
          return typeof value.text?.content === "string" ? value.text.content : "";
        })
        .join("")
        .trim();
      if (!content) {
        console.info("[notion] event=ignored reason=empty_comment source=webhook");
        return { accepted: true, reason: "empty_comment_content" };
      }
      if (!this.shouldRespondToContent(content)) {
        console.info("[notion] event=ignored reason=no_wake_word source=webhook");
        return { accepted: true, reason: "ignored_missing_wake_word" };
      }

      const createdBy =
        typeof comment.created_by === "object" && comment.created_by
          ? (comment.created_by as { id?: unknown })
          : undefined;
      const senderId = typeof createdBy?.id === "string" ? createdBy.id : "notion-user";
      console.info(
        formatLogLine("notion", "inbound", {
          source: "webhook",
          sourceId: pageId,
          senderId,
          eventId,
          content: sanitizeInline(content),
        }),
      );

      await this.inboundHandler({
        channelId: this.id,
        sourceId: pageId,
        senderId,
        senderName: senderId,
        content,
        timestamp: Date.now(),
        isGroup: true,
        mode: "conversational",
        raw: {
          source: "webhook",
          eventId,
          eventType,
          commentId,
          pageId,
        },
      });
      console.info(`[notion] event=accepted source=webhook page=${pageId}`);
      return { accepted: true };
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "notion_webhook_failed";
      console.info(`[notion] event=failed source=webhook reason=${this.lastError}`);
      return { accepted: false, reason: this.lastError };
    }
  }

  private shouldRespondToContent(content: string): boolean {
    return matchesWakeWord(content, this.wakeWords, this.requireWakeWord);
  }
}
