import type { InboundEnvelope } from "../types.js";

export function isSenderAllowed(allowFrom: string[], envelope: InboundEnvelope): boolean {
  if (allowFrom.length === 0) return true;
  if (allowFrom.includes("*")) return true;
  return allowFrom.includes(envelope.senderId);
}
