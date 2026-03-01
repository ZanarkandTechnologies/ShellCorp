import { Label } from "@/components/ui/label";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useAppStore } from "@/lib/app-store";
import { SecretsPanel } from "@/components/settings/secrets-panel";

export default function SettingsDialog({ trigger }: { trigger?: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const { isAuthenticated } = useConvexAuth();
    const { signOut } = useAuth();
    const router = useRouter();

    // App Store State - use selectors to prevent unnecessary re-renders
    const debugMode = useAppStore(state => state.debugMode);
    const setDebugMode = useAppStore(state => state.setDebugMode);
    const isBuilderMode = useAppStore(state => state.isBuilderMode);
    const setBuilderMode = useAppStore(state => state.setBuilderMode);

    const handleSignOut = async () => {
        await signOut();
        router.push("/");
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="icon" className="bg-background/80 backdrop-blur-sm shadow-sm">
                        <Settings className="h-5 w-5" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-6 py-4">
                    {/* Theme Settings */}
                    <div className="flex items-center justify-between">
                        <Label>Theme</Label>
                        <ThemeToggle />
                    </div>

                    {/* Debug Mode */}
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

                    {/* Builder Mode */}
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

                    {/* Secrets Management */}
                    {isAuthenticated && (
                        <div className="pt-4 border-t">
                            <SecretsPanel />
                        </div>
                    )}

                    {/* Account Settings */}
                    {isAuthenticated && (
                        <div className="pt-4 border-t flex flex-col gap-2">
                            <Label className="mb-2">Account</Label>
                            <Button
                                onClick={handleSignOut}
                                variant="destructive"
                                className="w-full flex items-center gap-2"
                            >
                                <LogOut className="h-4 w-4" />
                                Sign Out
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

