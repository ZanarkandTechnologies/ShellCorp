/**
 * Gateway envelope schema + mappers.
 *
 * Responsibility:
 * - Validate external ingestion payloads (`GatewayMessage`) via Zod.
 * - Convert between runtime envelopes (`InboundEnvelope`, `OutboundEnvelope`)
 *   and canonical storage records (`GatewayMessage`).
 */
import { z } from "zod";
import type { GatewayMessage, InboundEnvelope, OutboundEnvelope } from "../types.js";

export const gatewayModeSchema = z.enum(["conversational", "observational"]);
export const gatewayDirectionSchema = z.enum(["inbound", "outbound"]);

export const gatewayMessageSchema = z.object({
  channelId: z.string().min(1),
  sourceId: z.string().min(1),
  senderId: z.string().min(1),
  senderName: z.string().min(1),
  content: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  direction: gatewayDirectionSchema,
  mode: gatewayModeSchema,
  threadId: z.string().optional(),
  correlationId: z.string().optional(),
  callbackUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type GatewayMessageInput = z.input<typeof gatewayMessageSchema>;

export function parseGatewayMessage(input: unknown): GatewayMessage {
  return gatewayMessageSchema.parse(input);
}

export function inboundToMessage(envelope: InboundEnvelope): GatewayMessage {
  return {
    channelId: envelope.channelId,
    sourceId: envelope.sourceId,
    senderId: envelope.senderId,
    senderName: envelope.senderName,
    content: envelope.content,
    timestamp: envelope.timestamp,
    direction: "inbound",
    mode: envelope.mode ?? "conversational",
    threadId: envelope.threadId,
    correlationId: envelope.correlationId,
    // Raw payloads are wrapped in metadata to preserve debugging context
    // without coupling the canonical schema to provider-specific formats.
    metadata: envelope.raw ? { raw: envelope.raw } : undefined,
  };
}

export function outboundToMessage(
  envelope: OutboundEnvelope,
  senderName = "blitz",
  senderId = "blitz",
): GatewayMessage {
  return {
    channelId: envelope.channelId,
    sourceId: envelope.sourceId,
    senderId,
    senderName,
    content: envelope.content,
    timestamp: Date.now(),
    direction: "outbound",
    // Outbound records are always conversational because they represent replies.
    mode: "conversational",
    threadId: envelope.threadId,
    correlationId: envelope.correlationId,
  };
}
