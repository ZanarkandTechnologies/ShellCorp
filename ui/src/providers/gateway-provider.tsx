/**
 * GATEWAY PROVIDER
 * ================
 * Own the live WebSocket client for gateway-backed UI features.
 *
 * KEY CONCEPTS:
 * - Gateway config is local-ui state and can change at runtime.
 * - Saving config should reconnect in place instead of forcing a page reload.
 *
 * USAGE:
 * - Read `client` and `connected` via `useGateway()`.
 * - Call `updateConfig()` after settings changes to rebuild the client.
 *
 * MEMORY REFERENCES:
 * - MEM-0175
 */
"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import {
  type GatewayUiConfig,
  getGatewayUiConfig,
  saveGatewayUiConfig,
} from "@/lib/gateway-config";
import { GatewayWsClient } from "@/lib/gateway-ws-client";

type GatewayContextValue = {
  client: GatewayWsClient;
  connected: boolean;
  config: GatewayUiConfig;
  updateConfig: (next: Partial<GatewayUiConfig>) => GatewayUiConfig;
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
  const [config, setConfig] = useState<GatewayUiConfig>(() => getGatewayUiConfig());
  // #region agent log
  useEffect(() => {
    const tokenLen = config.gatewayToken?.trim?.()?.length ?? 0;
    fetch('http://127.0.0.1:7706/ingest/48051540-bc82-481a-91e8-13d7497ea0d8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4da9e5'},body:JSON.stringify({sessionId:'4da9e5',location:'gateway-provider.tsx:config',message:'Gateway config at provider',data:{gatewayBase:config.gatewayBase,tokenLength:tokenLen,hasToken:tokenLen>0},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  }, [config.gatewayBase, config.gatewayToken]);
  // #endregion
  const client = useMemo(
    () =>
      new GatewayWsClient({
        url: toGatewayWsUrl(config.gatewayBase),
        token: config.gatewayToken,
        onConnectionStateChange: setConnected,
      }),
    [config.gatewayBase, config.gatewayToken],
  );

  useEffect(() => {
    client.start();
    return () => {
      client.stop();
    };
  }, [client]);

  const value = useMemo(
    () => ({
      client,
      connected,
      config,
      updateConfig: (next: Partial<GatewayUiConfig>) => {
        const saved = saveGatewayUiConfig(next);
        setConfig(saved);
        return saved;
      },
    }),
    [client, config, connected],
  );
  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

export function useGateway(): GatewayContextValue {
  const context = useContext(GatewayContext);
  if (!context) {
    throw new Error("useGateway must be used within GatewayProvider");
  }
  return context;
}
