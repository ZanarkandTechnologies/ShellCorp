"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TeamData } from "@/lib/types";

interface TeamOptionsDialogProps {
    team: TeamData;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function TeamOptionsDialog({ team, isOpen, onOpenChange }: TeamOptionsDialogProps) {
    const handleAddDesk = async () => {
        try {
            // Vite visual-first phase: desk placement backend wiring is intentionally deferred.
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to add desk:", error);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{team.name} Options</DialogTitle>
                    <DialogDescription>
                        Manage your {team.name} team configuration.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Button onClick={handleAddDesk} className="w-full">
                        Place Desk for {team.name}
                    </Button>
                    {/* Placeholder for future options like Rename, Move Base, etc. */}
                    <Button variant="outline" disabled className="w-full">
                        Move Team Base (Coming Soon)
                    </Button>
                    <Button variant="outline" disabled className="w-full">
                        Edit Team Details (Coming Soon)
                    </Button>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

