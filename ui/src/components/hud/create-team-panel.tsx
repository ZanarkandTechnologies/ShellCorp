"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreateTeamForm } from "@/components/hud/create-team-form";

interface CreateTeamPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTeamPanel({ isOpen, onOpenChange }: CreateTeamPanelProps): React.JSX.Element {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Team</DialogTitle>
          <DialogDescription>
            Create a new team/project and optionally register role agents in OpenClaw.
          </DialogDescription>
        </DialogHeader>
        <CreateTeamForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
