import { EventEmitter } from "node:events";
import type { InboundEnvelope, OutboundEnvelope } from "../types.js";

export interface GatewayEvents {
  inbound_message: (envelope: InboundEnvelope) => void;
  outbound_message: (envelope: OutboundEnvelope) => void;
}

export class GatewayBus {
  private readonly emitter = new EventEmitter();

  on<K extends keyof GatewayEvents>(event: K, handler: GatewayEvents[K]): void {
    this.emitter.on(event, handler as (...args: unknown[]) => void);
  }

  emit<K extends keyof GatewayEvents>(event: K, payload: Parameters<GatewayEvents[K]>[0]): void {
    this.emitter.emit(event, payload);
  }
}
