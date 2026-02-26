"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { useAppStore } from "@/lib/app-store";

/**
 * SKILL MANAGER
 * =============
 * Main dialog component for managing skills with two view modes:
 * - Graph View: Interactive force-directed graph visualization (SkillSphereGrid)
 * - Grid View: Traditional grid layout for CRUD operations (SkillGrid)
 */

interface SkillManagerProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SkillManager({ isOpen, onOpenChange }: SkillManagerProps) {
    const setIsSkillsPanelOpen = useAppStore((state) => state.setIsSkillsPanelOpen);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] z-[1000]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5" />
                        Manage Skills
                    </DialogTitle>
                    <DialogDescription>
                        Open the Skills Panel to inspect shared and per-agent skills.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex items-center justify-end gap-2">
                    <Button
                        onClick={() => {
                            onOpenChange(false);
                            setIsSkillsPanelOpen(true);
                        }}
                    >
                        Open Skills Panel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
