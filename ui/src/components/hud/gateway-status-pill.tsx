import { useCallback, useEffect, useState } from "react";
import { Loader2, Wifi, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useGateway } from "@/providers/gateway-provider";

type GatewayStatusSnapshot = {
  connected: boolean;
  checking: boolean;
  label: string;
  detail: string | null;
};

function createDisconnectedSnapshot(message: string): GatewayStatusSnapshot {
  return {
    connected: false,
    checking: false,
    label: "Gateway Offline",
    detail: message,
  };
}

export function GatewayStatusPill(): JSX.Element {
  const { client, connected } = useGateway();
  const [snapshot, setSnapshot] = useState<GatewayStatusSnapshot>(() =>
    createDisconnectedSnapshot("Click to re-check"),
  );

  const refreshStatus = useCallback(async (): Promise<void> => {
    setSnapshot((current) => ({ ...current, checking: true, detail: null }));
    try {
      await client.request("status");
      setSnapshot({
        connected: true,
        checking: false,
        label: "Gateway Connected",
        detail: null,
      });
    } catch (error) {
      setSnapshot(
        createDisconnectedSnapshot(
          error instanceof Error && error.message.trim() ? error.message : "status request failed",
        ),
      );
    }
  }, [client]);

  useEffect(() => {
    if (!connected) {
      setSnapshot(createDisconnectedSnapshot("Socket disconnected"));
      return;
    }
    void refreshStatus();
  }, [connected, refreshStatus]);

  return (
    <div className="pointer-events-auto">
      <Button
        size="sm"
        variant="secondary"
        className="h-10 rounded-full border border-white/20 bg-black/65 px-4 text-white hover:bg-black/80"
        onClick={() => void refreshStatus()}
        title={snapshot.detail ?? "Click to refresh gateway status"}
      >
        {snapshot.checking ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : snapshot.connected ? (
          <Wifi className="mr-2 h-4 w-4 text-emerald-300" />
        ) : (
          <WifiOff className="mr-2 h-4 w-4 text-amber-300" />
        )}
        {snapshot.checking ? "Checking..." : snapshot.label}
      </Button>
    </div>
  );
}
