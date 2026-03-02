"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { gatewayBase, gatewayToken } from "@/lib/gateway-config";
import { GatewayWsClient } from "@/lib/gateway-ws-client";

type GatewayContextValue = {
  client: GatewayWsClient;
  connected: boolean;
};

const GatewayContext = createContext<GatewayContextValue | null>(null);

function toGatewayWsUrl(baseUrl: string): string {
  if (baseUrl.startsWith("ws://") || baseUrl.startsWith("wss://")) return baseUrl;
  if (baseUrl.startsWith("https://")) return `wss://${baseUrl.slice("https://".length)}`;
  if (baseUrl.startsWith("http://")) return `ws://${baseUrl.slice("http://".length)}`;
  return `ws://${baseUrl}`;
}

export function GatewayProvider({ children }: { children: ReactNode }): JSX.Element {
  const [connected, setConnected] = useState(false);
  const client = useMemo(
    () =>
      new GatewayWsClient({
        url: toGatewayWsUrl(gatewayBase),
        token: gatewayToken,
        onConnectionStateChange: setConnected,
      }),
    [],
  );

  useEffect(() => {
    client.start();
    return () => {
      client.stop();
    };
  }, [client]);

  const value = useMemo(() => ({ client, connected }), [client, connected]);
  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

export function useGateway(): GatewayContextValue {
  const context = useContext(GatewayContext);
  if (!context) {
    throw new Error("useGateway must be used within GatewayProvider");
  }
  return context;
}
