import type { BaseChannel } from "./base.js";
import type { InboundEnvelope, OutboundEnvelope } from "../types.js";

export class DiscordChannel implements BaseChannel {
  readonly id = "discord";
  private inboundHandler: ((envelope: InboundEnvelope) => Promise<void>) | null = null;

  setInboundHandler(handler: (envelope: InboundEnvelope) => Promise<void>): void {
    this.inboundHandler = handler;
  }

  async start(): Promise<void> {
    // SLC-1 stretch: adapter placeholder.
  }

  async stop(): Promise<void> {
    // no-op
  }

  async send(_envelope: OutboundEnvelope): Promise<void> {
    // SLC-1 stretch: adapter placeholder.
  }
}
