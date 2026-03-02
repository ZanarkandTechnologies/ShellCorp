"use client";

/**
 * USER TASKS PANEL
 * ================
 *
 * ShellCorp currently runs without the Convex user task backend in this
 * workspace mode. Keep this panel available from the HUD, but render a
 * safe placeholder instead of attempting unavailable API calls.
 */

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Inbox } from "lucide-react";

interface UserTasksPanelProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function UserTasksPanel({ isOpen, onOpenChange }: UserTasksPanelProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] z-[1000]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-primary" />
                        User Tasks
                    </DialogTitle>
                    <DialogDescription>
                        Task inbox is not connected in OpenClaw-only mode yet.
                    </DialogDescription>
                </DialogHeader>
                <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                    <div className="mb-2 flex items-center gap-2">
                        <Inbox className="h-4 w-4" />
                        <Badge variant="secondary">Coming Soon</Badge>
                    </div>
                    This panel is reserved for ask-user tasks once OpenClaw task inbox
                    wiring is enabled in ShellCorp.
                </div>
                <div className="flex justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
