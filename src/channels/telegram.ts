import { Bot } from "grammy";

import type { BaseChannel } from "./base.js";
import type { InboundEnvelope, OutboundEnvelope } from "../types.js";
import type { ProviderSetupSpec, ProviderStatus } from "./base.js";
import { formatLogLine, sanitizeInline } from "../logging/pretty.js";

export interface TelegramInboundInput {
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  isGroup: boolean;
  timestamp?: number;
  raw?: unknown;
}

export function normalizeTelegramInbound(input: TelegramInboundInput): InboundEnvelope {
  return {
    channelId: "telegram",
    sourceId: input.chatId,
    senderId: input.senderId,
    senderName: input.senderName,
    content: input.content,
    timestamp: input.timestamp ?? Date.now(),
    isGroup: input.isGroup,
    raw: input.raw,
  };
}

export class TelegramChannel implements BaseChannel {
  readonly id = "telegram";
  private inboundHandler: ((envelope: InboundEnvelope) => Promise<void>) | null = null;
  private readonly bot: Bot;
  private connected = false;
  private lastError: string | undefined;

  constructor(private readonly token: string) {
    this.bot = new Bot(token);
  }

  setInboundHandler(handler: (envelope: InboundEnvelope) => Promise<void>): void {
    this.inboundHandler = handler;
  }

  async start(): Promise<void> {
    try {
      this.bot.on("message:text", async (ctx) => {
        if (!this.inboundHandler) return;
        console.info(
          formatLogLine("telegram", "inbound", {
            sourceId: String(ctx.chat.id),
            senderId: String(ctx.from?.id ?? "unknown"),
            isGroup: ctx.chat.type.endsWith("group"),
            content: sanitizeInline(ctx.message.text),
          }),
        );
        await this.inboundHandler(
          normalizeTelegramInbound({
            chatId: String(ctx.chat.id),
            senderId: String(ctx.from?.id ?? "unknown"),
            senderName: ctx.from?.username ?? ctx.from?.first_name ?? "unknown",
            content: ctx.message.text,
            timestamp: Date.now(),
            isGroup: ctx.chat.type.endsWith("group"),
            raw: ctx.message,
          }),
        );
      });
      // grammY long-polling blocks indefinitely; start without awaiting startup loop.
      void this.bot.start().catch((error) => {
        this.connected = false;
        this.lastError = error instanceof Error ? error.message : "telegram_start_failed";
      });
      this.connected = true;
      this.lastError = undefined;
    } catch (error) {
      this.connected = false;
      this.lastError = error instanceof Error ? error.message : "telegram_start_failed";
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.bot.stop();
    this.connected = false;
  }

  async send(envelope: OutboundEnvelope): Promise<void> {
    await this.bot.api.sendMessage(envelope.sourceId, envelope.content);
  }

  getSetupSpec(): ProviderSetupSpec {
    return {
      providerId: this.id,
      title: "Telegram Bot",
      summary: "Connect a Telegram bot token and allow Fahrenheit to receive/send messages.",
      fields: [
        { key: "gateway.channels.telegram.enabled", label: "Enable channel", required: true, example: "true" },
        { key: "gateway.channels.telegram.botToken", label: "Bot token", required: true, secret: true },
      ],
      docsUrl: "https://core.telegram.org/bots/tutorial",
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
}
