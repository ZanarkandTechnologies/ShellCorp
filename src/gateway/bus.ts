/**
 * Lightweight typed event bus for gateway lifecycle events.
 *
 * Responsibility:
 * - Publish internal inbound/outbound events.
 * - Decouple observers (memory, analytics, audit enrichers) from router logic.
 */
import { EventEmitter } from "node:events";
import type { InboundEnvelope, OutboundEnvelope } from "../types.js";

export interface VersionedGatewayEvent<TPayload> {
  stateVersion: number;
  payload: TPayload;
}

export interface GatewayEvents {
  inbound_message: (event: VersionedGatewayEvent<InboundEnvelope>) => void;
  outbound_message: (event: VersionedGatewayEvent<OutboundEnvelope>) => void;
}

export class GatewayBus {
  private readonly emitter = new EventEmitter();
  private stateVersion = 0;

  on<K extends keyof GatewayEvents>(event: K, handler: GatewayEvents[K]): void {
    this.emitter.on(event, handler as (...args: unknown[]) => void);
  }

  emit<K extends keyof GatewayEvents>(event: K, payload: Parameters<GatewayEvents[K]>[0]): void {
    this.emitter.emit(event, payload);
  }

  emitVersioned<K extends keyof GatewayEvents>(
    event: K,
    payload: Parameters<GatewayEvents[K]>[0]["payload"],
  ): number {
    this.stateVersion += 1;
    this.emit(event, {
      stateVersion: this.stateVersion,
      payload,
    } as Parameters<GatewayEvents[K]>[0]);
    return this.stateVersion;
  }
}
