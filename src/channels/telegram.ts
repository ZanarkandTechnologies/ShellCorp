import { Bot } from "grammy";

import type { BaseChannel } from "./base.js";
import type { InboundEnvelope, OutboundEnvelope } from "../types.js";

export class TelegramChannel implements BaseChannel {
  readonly id = "telegram";
  private inboundHandler: ((envelope: InboundEnvelope) => Promise<void>) | null = null;
  private readonly bot: Bot;

  constructor(private readonly token: string) {
    this.bot = new Bot(token);
  }

  setInboundHandler(handler: (envelope: InboundEnvelope) => Promise<void>): void {
    this.inboundHandler = handler;
  }

  async start(): Promise<void> {
    this.bot.on("message:text", async (ctx) => {
      if (!this.inboundHandler) return;
      await this.inboundHandler({
        channelId: "telegram",
        chatId: String(ctx.chat.id),
        senderId: String(ctx.from?.id ?? "unknown"),
        senderName: ctx.from?.username ?? ctx.from?.first_name ?? "unknown",
        content: ctx.message.text,
        timestamp: Date.now(),
        isGroup: ctx.chat.type.endsWith("group"),
        raw: ctx.message,
      });
    });
    await this.bot.start();
  }

  async stop(): Promise<void> {
    await this.bot.stop();
  }

  async send(envelope: OutboundEnvelope): Promise<void> {
    await this.bot.api.sendMessage(envelope.chatId, envelope.content);
  }
}
