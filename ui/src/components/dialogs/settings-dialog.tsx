import { Label } from "@/components/ui/label";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Settings } from "lucide-react";
import { useAppStore } from "@/lib/app-store";

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

    return (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
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
                </div>
            </DialogContent>
        </Dialog>
    );
}

