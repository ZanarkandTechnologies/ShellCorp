import type { InboundEnvelope, OutboundEnvelope } from "../types.js";

export interface ProviderSetupField {
  key: string;
  label: string;
  required: boolean;
  secret?: boolean;
  example?: string;
}

export interface ProviderSetupSpec {
  providerId: string;
  title: string;
  summary: string;
  fields: ProviderSetupField[];
  docsUrl?: string;
}

export interface ProviderStatus {
  providerId: string;
  enabled: boolean;
  connected: boolean;
  mode: "native" | "bridge";
  lastError?: string;
  qrAscii?: string;
}

export interface BaseChannel {
  id: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(envelope: OutboundEnvelope): Promise<void>;
  setInboundHandler(handler: (envelope: InboundEnvelope) => Promise<void>): void;
  getSetupSpec(): ProviderSetupSpec;
  getStatus(): ProviderStatus;
}
