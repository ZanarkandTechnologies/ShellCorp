import type { BaseChannel, ProviderSetupSpec, ProviderStatus } from "./base.js";
import type { InboundEnvelope, OutboundEnvelope } from "../types.js";

export class CustomEndpointChannel implements BaseChannel {
  readonly id = "custom";
  private inboundHandler: ((envelope: InboundEnvelope) => Promise<void>) | null = null;

  setInboundHandler(handler: (envelope: InboundEnvelope) => Promise<void>): void {
    this.inboundHandler = handler;
  }

  async start(): Promise<void> {}

  async stop(): Promise<void> {}

  async send(_envelope: OutboundEnvelope): Promise<void> {}

  getSetupSpec(): ProviderSetupSpec {
    return {
      providerId: this.id,
      title: "Custom HTTP Endpoint",
      summary: "Use gateway /ingest to push normalized events and start new sessions.",
      fields: [
        { key: "gateway.channels.custom.enabled", label: "Enable channel", required: true, example: "true" },
        {
          key: "gateway.channels.custom.ingestPath",
          label: "Ingest endpoint path",
          required: false,
          example: "/ingest",
        },
      ],
      docsUrl: "https://deepwiki.com/openclaw/openclaw",
    };
  }

  getStatus(): ProviderStatus {
    return {
      providerId: this.id,
      enabled: true,
      connected: true,
      mode: "bridge",
    };
  }
}
