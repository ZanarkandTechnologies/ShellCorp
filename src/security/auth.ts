import type { ChannelId, InboundEnvelope } from "../types.js";
import type { FahrenheitConfig } from "../config/schema.js";

function listForChannel(config: FahrenheitConfig, channelId: ChannelId): string[] {
  const knownChannels = config.channels as Record<string, { allowFrom?: string[] }>;
  const known = knownChannels[channelId];
  if (known?.allowFrom) return known.allowFrom;

  const provider = config.providers[channelId];
  if (provider?.allowFrom) return provider.allowFrom;

  return [];
}

export function isSenderAllowed(config: FahrenheitConfig, envelope: InboundEnvelope): boolean {
  const allowFrom = listForChannel(config, envelope.channelId);
  if (allowFrom.length === 0) return true;
  if (allowFrom.includes("*")) return true;
  return allowFrom.includes(envelope.senderId);
}
