import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/app-store";
import { getGatewayUiConfig } from "@/lib/gateway-config";
import { setOfficeOnboardingCompleted } from "@/lib/office-onboarding";
import type { OfficeSettingsModel } from "@/lib/openclaw-types";
import { UI_Z } from "@/lib/z-index";
import { useGateway } from "@/providers/gateway-provider";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";

type SettingsDialogProps = {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function SettingsDialog(props: SettingsDialogProps) {
  const { open, onOpenChange } = props;
  const adapter = useOpenClawAdapter();
  const { officeSettings, refresh } = useOfficeDataContext();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const dialogOpen = typeof open === "boolean" ? open : uncontrolledOpen;
  const setDialogOpen = onOpenChange ?? setUncontrolledOpen;
  const debugMode = useAppStore((state) => state.debugMode);
  const setDebugMode = useAppStore((state) => state.setDebugMode);
  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const setBuilderMode = useAppStore((state) => state.setBuilderMode);
  const setIsOfficeOnboardingVisible = useAppStore((state) => state.setIsOfficeOnboardingVisible);
  const setOfficeOnboardingStep = useAppStore((state) => state.setOfficeOnboardingStep);
  const { connected, updateConfig } = useGateway();
  const gatewayConfig = useMemo(() => getGatewayUiConfig(), []);
  const [gatewayBaseInput, setGatewayBaseInput] = useState(gatewayConfig.gatewayBase);
  const [gatewayTokenInput, setGatewayTokenInput] = useState(gatewayConfig.gatewayToken);
  const [stateBaseInput, setStateBaseInput] = useState(gatewayConfig.stateBase);
  const [defaultSessionKeyInput, setDefaultSessionKeyInput] = useState(
    gatewayConfig.defaultSessionKey,
  );
  const [languageInput, setLanguageInput] = useState(gatewayConfig.language);
  const [statusText, setStatusText] = useState("");
  const [viewProfileInput, setViewProfileInput] = useState<OfficeSettingsModel["viewProfile"]>(
    officeSettings.viewProfile,
  );
  const [cameraOrientationInput, setCameraOrientationInput] = useState<
    OfficeSettingsModel["cameraOrientation"]
  >(officeSettings.cameraOrientation);
  const [orbitControlsEnabled, setOrbitControlsEnabled] = useState(
    officeSettings.orbitControlsEnabled,
  );
  const [viewStatusText, setViewStatusText] = useState("");
  const [isSavingViewSettings, setIsSavingViewSettings] = useState(false);

  useEffect(() => {
    if (!dialogOpen) return;
    const next = getGatewayUiConfig();
    setGatewayBaseInput(next.gatewayBase);
    setGatewayTokenInput(next.gatewayToken);
    setStateBaseInput(next.stateBase);
    setDefaultSessionKeyInput(next.defaultSessionKey);
    setLanguageInput(next.language);
    setStatusText("");
    setViewProfileInput(officeSettings.viewProfile);
    setCameraOrientationInput(officeSettings.cameraOrientation);
    setOrbitControlsEnabled(officeSettings.orbitControlsEnabled);
    setViewStatusText("");
  }, [
    dialogOpen,
    officeSettings.cameraOrientation,
    officeSettings.orbitControlsEnabled,
    officeSettings.viewProfile,
  ]);

  function handleRefreshGatewayConfig(): void {
    const next = getGatewayUiConfig();
    setGatewayBaseInput(next.gatewayBase);
    setGatewayTokenInput(next.gatewayToken);
    setStateBaseInput(next.stateBase);
    setDefaultSessionKeyInput(next.defaultSessionKey);
    setLanguageInput(next.language);
    setStatusText("Gateway config reloaded from local settings.");
  }

  function handleConnectGateway(): void {
    const saved = updateConfig({
      gatewayBase: gatewayBaseInput,
      gatewayToken: gatewayTokenInput,
      stateBase: stateBaseInput,
      defaultSessionKey: defaultSessionKeyInput,
      language: languageInput,
    });
    setGatewayBaseInput(saved.gatewayBase);
    setGatewayTokenInput(saved.gatewayToken);
    setStateBaseInput(saved.stateBase);
    setDefaultSessionKeyInput(saved.defaultSessionKey);
    setLanguageInput(saved.language);
    setStatusText("Gateway config saved. Reconnecting gateway client...");
  }

  async function handleSaveViewSettings(): Promise<void> {
    setIsSavingViewSettings(true);
    setViewStatusText("");
    const result = await adapter.saveOfficeSettings({
      ...officeSettings,
      viewProfile: viewProfileInput,
      cameraOrientation: cameraOrientationInput,
      orbitControlsEnabled,
    });
    setIsSavingViewSettings(false);
    if (!result.ok) {
      setViewStatusText(result.error ?? "Failed to save office view settings.");
      return;
    }
    await refresh();
    setViewStatusText("Office view settings saved.");
  }

  function handleReplayOnboarding(): void {
    setOfficeOnboardingCompleted(false);
    setIsOfficeOnboardingVisible(true);
    setOfficeOnboardingStep("click-ceo");
    setDialogOpen(false);
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent
        className="max-w-md max-h-[85vh] overflow-y-auto"
        style={{ zIndex: UI_Z.panelBase }}
      >
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-6 py-4">
          <div className="flex items-center justify-between">
            <Label>Theme</Label>
            <ThemeToggle />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Label>Debug Mode</Label>
              <span className="text-xs text-muted-foreground">Show paths and grid info</span>
            </div>
            <Button
              onClick={() => setDebugMode(!debugMode)}
              variant={debugMode ? "default" : "outline"}
              size="sm"
            >
              {debugMode ? "On" : "Off"}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Label>Builder Mode</Label>
              <span className="text-xs text-muted-foreground">
                Move furniture and arrange office
              </span>
            </div>
            <Button
              onClick={() => setBuilderMode(!isBuilderMode)}
              variant={isBuilderMode ? "default" : "outline"}
              size="sm"
            >
              {isBuilderMode ? "On" : "Off"}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Label>Onboarding Tour</Label>
              <span className="text-xs text-muted-foreground">
                Replay the guided AI Office intro and CEO-first onboarding flow.
              </span>
            </div>
            <Button onClick={handleReplayOnboarding} variant="outline" size="sm">
              Replay
            </Button>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="flex flex-col gap-1">
              <Label>Office View</Label>
              <span className="text-xs text-muted-foreground">
                Switch between free-orbit 3D and a locked 2.5D game view.
              </span>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">View Profile</Label>
              <select
                className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                value={viewProfileInput}
                onChange={(event) =>
                  setViewProfileInput(event.target.value as OfficeSettingsModel["viewProfile"])
                }
              >
                <option value="free_orbit_3d">Free Orbit 3D</option>
                <option value="fixed_2_5d">Isometric 2.5D</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Camera Orientation</Label>
              <select
                className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                value={cameraOrientationInput}
                onChange={(event) =>
                  setCameraOrientationInput(
                    event.target.value as OfficeSettingsModel["cameraOrientation"],
                  )
                }
              >
                <option value="south_east">South East</option>
                <option value="south_west">South West</option>
                <option value="north_east">North East</option>
                <option value="north_west">North West</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <Label>Orbit Controls</Label>
                <span className="text-xs text-muted-foreground">
                  In fixed 2.5D, this keeps pan and zoom without unlocking rotation.
                </span>
              </div>
              <Button
                onClick={() => setOrbitControlsEnabled(!orbitControlsEnabled)}
                variant={orbitControlsEnabled ? "default" : "outline"}
                size="sm"
              >
                {orbitControlsEnabled ? "On" : "Off"}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => void handleSaveViewSettings()}
                disabled={isSavingViewSettings}
              >
                {isSavingViewSettings ? "Saving..." : "Apply View"}
              </Button>
            </div>
            {viewStatusText ? (
              <p className="text-xs text-muted-foreground">{viewStatusText}</p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <Label>Gateway Access</Label>
                <span className="text-xs text-muted-foreground">
                  Configure connection values used by the UI bridge.
                </span>
              </div>
              <span className={`text-xs ${connected ? "text-emerald-500" : "text-amber-500"}`}>
                {connected ? "connected" : "disconnected"}
              </span>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Gateway URL</Label>
              <Input
                value={gatewayBaseInput}
                onChange={(event) => setGatewayBaseInput(event.target.value)}
                placeholder="http://127.0.0.1:18789"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Gateway Token</Label>
              <Input
                type="password"
                value={gatewayTokenInput}
                onChange={(event) => setGatewayTokenInput(event.target.value)}
                placeholder="optional bearer token"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">State Bridge URL</Label>
              <Input
                value={stateBaseInput}
                onChange={(event) => setStateBaseInput(event.target.value)}
                placeholder={
                  typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5173"
                }
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Default Session Key</Label>
              <Input
                value={defaultSessionKeyInput}
                onChange={(event) => setDefaultSessionKeyInput(event.target.value)}
                placeholder="agent:main:..."
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Language</Label>
              <select
                className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                value={languageInput}
                onChange={(event) => setLanguageInput(event.target.value)}
              >
                <option value="English">English</option>
                <option value="Japanese">Japanese</option>
                <option value="Chinese">Chinese</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleConnectGateway}>
                Connect
              </Button>
              <Button size="sm" variant="outline" onClick={handleRefreshGatewayConfig}>
                Refresh
              </Button>
            </div>
            {statusText ? <p className="text-xs text-muted-foreground">{statusText}</p> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
