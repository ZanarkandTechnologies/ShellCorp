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
import { randomUUID } from "node:crypto";
import type { FahrenheitConfig } from "../config/schema.js";
import { isSenderAllowed } from "../security/auth.js";
import type { LogSink } from "../logging/sink.js";
import type { BrainRuntime } from "../agent/runner.js";
import type { MessageStore } from "./message-store.js";
import type { GatewayBus } from "./bus.js";
import { inboundToMessage, outboundToMessage } from "./schema.js";
import { resolveRoute } from "./routing.js";
import type { ObservationIngestPayload } from "../memory/pipeline.js";

function buildPromptInput(envelope: InboundEnvelope): string {
  const raw = envelope.raw && typeof envelope.raw === "object" ? (envelope.raw as { history?: unknown }) : undefined;
  const history =
    raw && Array.isArray(raw.history) ? raw.history.filter((item): item is string => typeof item === "string") : [];
  if (history.length === 0) return envelope.content;
  return [
    "Recent conversation context (oldest to newest):",
    ...history.map((line) => `- ${line}`),
    "",
    `Latest user message: ${envelope.content}`,
  ].join("\n");
}

export class GatewayRouter {
  constructor(
    private readonly config: FahrenheitConfig,
    private readonly brain: BrainRuntime,
    private readonly logSink: LogSink,
    private readonly store: MessageStore,
    private readonly bus: GatewayBus,
    private readonly onObservationalEvent?: (payload: ObservationIngestPayload) => Promise<void>,
  ) {}

  async handleInbound(envelope: InboundEnvelope): Promise<OutboundEnvelope | null> {
    // MEM-0009 decision: correlation IDs trace inbound -> runtime -> outbound lifecycle.
    const correlationId = envelope.correlationId ?? randomUUID();
    const route = resolveRoute(this.config, envelope);
    if (!route) {
      const droppedMessage = inboundToMessage({ ...envelope, content: "[dropped unmatched group]" });
      await this.store.ingest(droppedMessage);
      await this.logSink.logChannelMessage({
        ts: Date.now(),
        direction: "inbound",
        channelId: envelope.channelId,
        sourceId: envelope.sourceId,
        correlationId,
        senderId: envelope.senderId,
        content: "[dropped unmatched group]",
      });
      return null;
    }

    if (!isSenderAllowed(route.allowFrom, envelope)) {
      // Even blocked messages are written to storage for auditability.
      const blockedMessage = inboundToMessage({ ...envelope, content: "[blocked unauthorized message]" });
      await this.store.ingest(blockedMessage);
      await this.logSink.logChannelMessage({
        ts: Date.now(),
        direction: "inbound",
        channelId: envelope.channelId,
        sourceId: envelope.sourceId,
        correlationId,
        senderId: envelope.senderId,
        content: "[blocked unauthorized message]",
      });
      return null;
    }

    const inboundMessage = inboundToMessage(envelope);
    inboundMessage.metadata = {
      ...(inboundMessage.metadata ?? {}),
      groupId: route.groupId,
      sessionKey: route.sessionKey,
      correlationId,
    };
    await this.store.ingest(inboundMessage);
    this.bus.emitVersioned("inbound_message", envelope);

    await this.logSink.logChannelMessage({
      ts: Date.now(),
      direction: "inbound",
      channelId: envelope.channelId,
      sourceId: envelope.sourceId,
      correlationId,
      senderId: envelope.senderId,
      content: envelope.content,
    });

    if ((envelope.mode ?? route.mode) === "observational") {
      // Observational events are captured and logged, but do not trigger replies.
      if (this.onObservationalEvent) {
        await this.onObservationalEvent({
          envelope,
          groupId: route.groupId,
          sessionKey: route.sessionKey,
          correlationId,
        });
      }
      return null;
    }

    const promptInput = buildPromptInput(envelope);
    const mockReply = this.config.runtime.agent.mockReply.trim();
    const response = mockReply
      ? mockReply
      : await this.brain.handleMessage(route.sessionKey, promptInput, {
          busyPolicy: route.busyPolicy,
          correlationId,
        });

    const outbound: OutboundEnvelope = {
      channelId: envelope.channelId,
      sourceId: envelope.sourceId,
      threadId: envelope.threadId,
      correlationId,
      content: response,
      raw: envelope.raw,
    };

    const outboundMessage = outboundToMessage(outbound);
    outboundMessage.metadata = {
      ...(outboundMessage.metadata ?? {}),
      groupId: route.groupId,
      sessionKey: route.sessionKey,
      correlationId,
    };
    await this.store.ingest(outboundMessage);
    this.bus.emitVersioned("outbound_message", outbound);

    await this.logSink.logChannelMessage({
      ts: Date.now(),
      direction: "outbound",
      channelId: outbound.channelId,
      sourceId: outbound.sourceId,
      correlationId,
      content: outbound.content,
    });

    return outbound;
  }
}
