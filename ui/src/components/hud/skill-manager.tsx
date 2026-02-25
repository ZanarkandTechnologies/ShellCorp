"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, Network, List } from "lucide-react";
import { SkillSphereGrid } from "@/features/skills-system/components";
import { SkillGrid } from "@/features/skills-system/components/skill-grid";

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
    // View mode state: "graph" for visualization, "grid" for CRUD operations
    const [viewMode, setViewMode] = useState<"graph" | "grid">("graph");

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[1200px] h-[90vh] flex flex-col z-[1000] p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5" />
                        Manage Skills
                    </DialogTitle>
                    <DialogDescription>
                        Visual skill tree and management system
                    </DialogDescription>
                </DialogHeader>

                {/* Graph View: Interactive D3 force-directed visualization */}
                {viewMode === "graph" && (
                    <div className="flex-1 min-h-0 relative">
                        <SkillSphereGrid />
                    </div>
                )}

                {/* Grid View: Traditional grid layout with CRUD operations */}
                {viewMode === "grid" && (
                    <SkillGrid onEditStart={() => setViewMode("grid")} />
                )}

                {/* View Toggle: Switch between graph and grid views */}
                <Button
                    size="icon"
                    className="absolute bottom-4 right-4 z-20 rounded-full w-10 h-10 bg-primary hover:bg-primary/90 shadow-lg"
                    onClick={() => setViewMode(viewMode === "graph" ? "grid" : "graph")}
                    title={viewMode === "graph" ? "Switch to Grid View" : "Switch to Graph View"}
                >
                    {viewMode === "graph" ? (
                        <List className="w-4 h-4" />
                    ) : (
                        <Network className="w-4 h-4" />
                    )}
                </Button>
            </DialogContent>
        </Dialog>
    );
}
