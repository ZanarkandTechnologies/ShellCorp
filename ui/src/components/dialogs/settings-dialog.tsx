import { Label } from "@/components/ui/label";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import { Settings } from "lucide-react";
import { useAppStore } from "@/lib/app-store";
import { getGatewayUiConfig, saveGatewayUiConfig } from "@/lib/gateway-config";
import { useGateway } from "@/providers/gateway-provider";
import { UI_Z } from "@/lib/z-index";

type SettingsDialogProps = {
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
};

export default function SettingsDialog({ trigger, open, onOpenChange }: SettingsDialogProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const dialogOpen = typeof open === "boolean" ? open : uncontrolledOpen;
    const setDialogOpen = onOpenChange ?? setUncontrolledOpen;
    const debugMode = useAppStore(state => state.debugMode);
    const setDebugMode = useAppStore(state => state.setDebugMode);
    const isBuilderMode = useAppStore(state => state.isBuilderMode);
    const setBuilderMode = useAppStore(state => state.setBuilderMode);
    const { connected } = useGateway();
    const gatewayConfig = useMemo(() => getGatewayUiConfig(), []);
    const [gatewayBaseInput, setGatewayBaseInput] = useState(gatewayConfig.gatewayBase);
    const [gatewayTokenInput, setGatewayTokenInput] = useState(gatewayConfig.gatewayToken);
    const [stateBaseInput, setStateBaseInput] = useState(gatewayConfig.stateBase);
    const [defaultSessionKeyInput, setDefaultSessionKeyInput] = useState(gatewayConfig.defaultSessionKey);
    const [languageInput, setLanguageInput] = useState(gatewayConfig.language);
    const [statusText, setStatusText] = useState("");

    useEffect(() => {
        if (!dialogOpen) return;
        const next = getGatewayUiConfig();
        setGatewayBaseInput(next.gatewayBase);
        setGatewayTokenInput(next.gatewayToken);
        setStateBaseInput(next.stateBase);
        setDefaultSessionKeyInput(next.defaultSessionKey);
        setLanguageInput(next.language);
        setStatusText("");
    }, [dialogOpen]);

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
        saveGatewayUiConfig({
            gatewayBase: gatewayBaseInput,
            gatewayToken: gatewayTokenInput,
            stateBase: stateBaseInput,
            defaultSessionKey: defaultSessionKeyInput,
            language: languageInput,
        });
        setStatusText("Gateway config saved. Reloading UI...");
        if (typeof window !== "undefined") {
            window.setTimeout(() => window.location.reload(), 250);
        }
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" style={{ zIndex: UI_Z.panelBase }}>
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
                            {debugMode ? 'On' : 'Off'}
                        </Button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <Label>Builder Mode</Label>
                            <span className="text-xs text-muted-foreground">Move furniture and arrange office</span>
                        </div>
                        <Button
                            onClick={() => setBuilderMode(!isBuilderMode)}
                            variant={isBuilderMode ? "default" : "outline"}
                            size="sm"
                        >
                            {isBuilderMode ? 'On' : 'Off'}
                        </Button>
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
                                placeholder={typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5173"}
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

