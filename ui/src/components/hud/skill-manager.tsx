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
  const setSelectedSkillStudioSkillId = useAppStore((state) => state.setSelectedSkillStudioSkillId);
  const setSkillStudioFocusAgentId = useAppStore((state) => state.setSkillStudioFocusAgentId);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] z-[1000]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Skill Studio
          </DialogTitle>
          <DialogDescription>
            Open Skill Studio to inspect package files, diagrams, metadata, and runnable demo cases.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={() => {
              onOpenChange(false);
              setSelectedSkillStudioSkillId(null);
              setSkillStudioFocusAgentId(null);
              setIsSkillsPanelOpen(true);
            }}
          >
            Open Skill Studio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
