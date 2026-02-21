import type { ChannelId, InboundEnvelope } from "../types.js";
import type { BahamutConfig } from "../config/schema.js";

function listForChannel(config: BahamutConfig, channelId: ChannelId): string[] {
  if (channelId === "telegram") return config.channels.telegram.allowFrom;
  if (channelId === "discord") return config.channels.discord.allowFrom;
  if (channelId === "slack") return config.channels.slack.allowFrom;
  if (channelId === "whatsapp") return config.channels.whatsapp.allowFrom;
  return [];
}

export function isSenderAllowed(config: BahamutConfig, envelope: InboundEnvelope): boolean {
  const allowFrom = listForChannel(config, envelope.channelId);
  if (allowFrom.length === 0) return true;
  if (allowFrom.includes("*")) return true;
  return allowFrom.includes(envelope.senderId);
}
