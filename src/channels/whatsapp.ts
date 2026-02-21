import type { BaseChannel } from "./base.js";
import type { InboundEnvelope, OutboundEnvelope } from "../types.js";

export class WhatsAppChannel implements BaseChannel {
  readonly id = "whatsapp";
  private inboundHandler: ((envelope: InboundEnvelope) => Promise<void>) | null = null;

  setInboundHandler(handler: (envelope: InboundEnvelope) => Promise<void>): void {
    this.inboundHandler = handler;
  }

  async start(): Promise<void> {
    // SLC-2 adapter placeholder.
  }

  async stop(): Promise<void> {
    // no-op
  }

  async send(_envelope: OutboundEnvelope): Promise<void> {
    // SLC-2 adapter placeholder.
  }
}
