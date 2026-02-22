/**
 * Gateway routing pipeline.
 *
 * Responsibility:
 * - Apply sender authorization.
 * - Persist inbound/outbound records to the source-of-truth message store.
 * - Dispatch conversational messages to the brain runtime.
 * - Emit internal bus events for downstream observers.
 */
import type { InboundEnvelope, OutboundEnvelope } from "../types.js";
import type { FahrenheitConfig } from "../config/schema.js";
import { isSenderAllowed } from "../security/auth.js";
import type { LogSink } from "../logging/sink.js";
import type { BrainRuntime } from "../agent/runner.js";
import type { MessageStore } from "./message-store.js";
import type { GatewayBus } from "./bus.js";
import { inboundToMessage, outboundToMessage } from "./schema.js";

export class GatewayRouter {
  constructor(
    private readonly config: FahrenheitConfig,
    private readonly brain: BrainRuntime,
    private readonly logSink: LogSink,
    private readonly store: MessageStore,
    private readonly bus: GatewayBus,
  ) {}

  async handleInbound(envelope: InboundEnvelope): Promise<OutboundEnvelope | null> {
    if (!isSenderAllowed(this.config, envelope)) {
      // Even blocked messages are written to storage for auditability.
      const blockedMessage = inboundToMessage({ ...envelope, content: "[blocked unauthorized message]" });
      await this.store.ingest(blockedMessage);
      await this.logSink.logChannelMessage({
        ts: Date.now(),
        direction: "inbound",
        channelId: envelope.channelId,
        sourceId: envelope.sourceId,
        senderId: envelope.senderId,
        content: "[blocked unauthorized message]",
      });
      return null;
    }

    const inboundMessage = inboundToMessage(envelope);
    await this.store.ingest(inboundMessage);
    this.bus.emit("inbound_message", envelope);

    await this.logSink.logChannelMessage({
      ts: Date.now(),
      direction: "inbound",
      channelId: envelope.channelId,
      sourceId: envelope.sourceId,
      senderId: envelope.senderId,
      content: envelope.content,
    });

    if ((envelope.mode ?? "conversational") === "observational") {
      // Observational events are captured and logged, but do not trigger replies.
      return null;
    }

    // Session key is channel+source scoped, preserving independent conversation contexts.
    const sessionKey = `brain:${envelope.channelId}:${envelope.sourceId}`;
    const response = await this.brain.handleMessage(sessionKey, envelope.content);

    const outbound: OutboundEnvelope = {
      channelId: envelope.channelId,
      sourceId: envelope.sourceId,
      threadId: envelope.threadId,
      content: response,
    };

    await this.store.ingest(outboundToMessage(outbound));
    this.bus.emit("outbound_message", outbound);

    await this.logSink.logChannelMessage({
      ts: Date.now(),
      direction: "outbound",
      channelId: outbound.channelId,
      sourceId: outbound.sourceId,
      content: outbound.content,
    });

    return outbound;
  }
}
