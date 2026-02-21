import type { InboundEnvelope, OutboundEnvelope } from "../types.js";
import type { BahamutConfig } from "../config/schema.js";
import { isSenderAllowed } from "../security/auth.js";
import type { LogSink } from "../logging/sink.js";
import type { BrainRuntime } from "../agent/runner.js";

export class GatewayRouter {
  constructor(
    private readonly config: BahamutConfig,
    private readonly brain: BrainRuntime,
    private readonly logSink: LogSink,
  ) {}

  async handleInbound(envelope: InboundEnvelope): Promise<OutboundEnvelope | null> {
    if (!isSenderAllowed(this.config, envelope)) {
      await this.logSink.logChannelMessage({
        ts: Date.now(),
        direction: "inbound",
        channelId: envelope.channelId,
        chatId: envelope.chatId,
        senderId: envelope.senderId,
        content: "[blocked unauthorized message]",
      });
      return null;
    }

    await this.logSink.logChannelMessage({
      ts: Date.now(),
      direction: "inbound",
      channelId: envelope.channelId,
      chatId: envelope.chatId,
      senderId: envelope.senderId,
      content: envelope.content,
    });

    const sessionKey = `brain:${envelope.channelId}:${envelope.chatId}`;
    const response = await this.brain.handleMessage(sessionKey, envelope.content);

    const outbound: OutboundEnvelope = {
      channelId: envelope.channelId,
      chatId: envelope.chatId,
      threadId: envelope.threadId,
      content: response,
    };

    await this.logSink.logChannelMessage({
      ts: Date.now(),
      direction: "outbound",
      channelId: outbound.channelId,
      chatId: outbound.chatId,
      content: outbound.content,
    });

    return outbound;
  }
}
