"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { useAppStore } from "@/lib/app-store";
import { useOfficeDataContext } from "@/providers/office-data-provider";

/**
 * MANAGE AGENT MODAL
 * ==================
 * Zanarkand-style modal shell with parity tabs while backend
 * capabilities are being wired for ShellCorp.
 */
export function ManageAgentModal(): JSX.Element {
    const manageAgentEmployeeId = useAppStore((state) => state.manageAgentEmployeeId);
    const setManageAgentEmployeeId = useAppStore((state) => state.setManageAgentEmployeeId);
    const { employees } = useOfficeDataContext();
    const employee = employees.find((row) => row._id === manageAgentEmployeeId) ?? null;
    const isOpen = !!manageAgentEmployeeId;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && setManageAgentEmployeeId(null)}>
            <DialogContent className="sm:max-w-4xl min-h-[90vh] z-[1000]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Manage Agent: {employee?.name ?? "Agent"}
                    </DialogTitle>
                    <DialogDescription>
                        Configure capabilities, tools, goals, and orchestration settings.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="goals">Goals</TabsTrigger>
                        <TabsTrigger value="tools">Tools</TabsTrigger>
                        <TabsTrigger value="skills">Skills</TabsTrigger>
                        <TabsTrigger value="agent-loop">Agent Loop</TabsTrigger>
                    </TabsList>
                    <ScrollArea className="h-full min-h-[65vh] max-h-[65vh] mt-4 pr-3">
                        <TabsContent value="overview" className="space-y-4">
                            <div className="rounded-md border p-4 text-sm text-muted-foreground">
                                Parity modal shell restored. Overview wiring to OpenClaw-backed profile fields is next.
                            </div>
                        </TabsContent>
                        <TabsContent value="goals" className="space-y-4">
                            <div className="rounded-md border p-4 text-sm text-muted-foreground">
                                Goals editor UI placeholder ready for ShellCorp goal/task mapping.
                            </div>
                        </TabsContent>
                        <TabsContent value="tools" className="space-y-4">
                            <div className="rounded-md border p-4 text-sm text-muted-foreground">
                                Tools selection UI placeholder ready for adapter-based tool policy mapping.
                            </div>
                        </TabsContent>
                        <TabsContent value="skills" className="space-y-4">
                            <div className="rounded-md border p-4 text-sm text-muted-foreground">
                                Skills tab shell restored; full data binding will target OpenClaw skill metadata.
                            </div>
                        </TabsContent>
                        <TabsContent value="agent-loop" className="space-y-4">
                            <div className="rounded-md border p-4 text-sm text-muted-foreground">
                                Agent loop controls shell restored for parity; runtime controls pending backend mapping.
                            </div>
                        </TabsContent>
                    </ScrollArea>
                </Tabs>

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    <Button variant="outline" onClick={() => setManageAgentEmployeeId(null)}>
                        Close
                    </Button>
                    <Button disabled>Save Changes</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

