import type { InboundEnvelope, OutboundEnvelope } from "../types.js";

export interface BaseChannel {
  id: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(envelope: OutboundEnvelope): Promise<void>;
  setInboundHandler(handler: (envelope: InboundEnvelope) => Promise<void>): void;
}
