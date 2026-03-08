"use client";

/**
 * USE GATEWAY SUBSCRIPTION
 * ========================
 * Wraps client.subscribe() teardown so callers don't need to manually
 * manage unsubscribe in useEffect returns.
 *
 * KEY CONCEPTS:
 * - Automatically unsubscribes on deps change or unmount.
 * - `listener` should be stable (wrap in useCallback at the call site).
 *
 * USAGE:
 * - useGatewaySubscription(client, (event) => { if (event.event !== "chat") return; ... }, [activeRunId]);
 *
 * MEMORY REFERENCES:
 * - MEM-0144 refactor: Phase 2 hook extraction
 */
import { useEffect } from "react";
import type { GatewayWsClient, GatewayEventFrame } from "@/lib/gateway-ws-client";

export function useGatewaySubscription(
  client: GatewayWsClient,
  listener: (event: GatewayEventFrame) => void,
  deps: readonly unknown[],
): void {
  useEffect(() => {
    const unsubscribe = client.subscribe(listener);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, listener, ...deps]);
}
