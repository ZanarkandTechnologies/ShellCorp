"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { OpenClawAdapter } from "@/lib/openclaw-adapter";
import { useGateway } from "@/providers/gateway-provider";

type OpenClawAdapterContextValue = {
  adapter: OpenClawAdapter;
};

const OpenClawAdapterContext = createContext<OpenClawAdapterContextValue | null>(null);

export function OpenClawAdapterProvider({ children }: { children: ReactNode }): JSX.Element {
  const { client: wsClient, config } = useGateway();
  const value = useMemo(
    () => ({
      adapter: new OpenClawAdapter("", config.stateBase, wsClient),
    }),
    [config.stateBase, wsClient],
  );
  return (
    <OpenClawAdapterContext.Provider value={value}>{children}</OpenClawAdapterContext.Provider>
  );
}

export function useOpenClawAdapter(): OpenClawAdapter {
  const context = useContext(OpenClawAdapterContext);
  if (!context) {
    throw new Error("useOpenClawAdapter must be used within OpenClawAdapterProvider");
  }
  return context.adapter;
}
