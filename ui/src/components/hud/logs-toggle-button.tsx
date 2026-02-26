import { ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";

type LogsToggleButtonProps = {
  isOpen: boolean;
  onToggle: () => void;
};

export function LogsToggleButton({ isOpen, onToggle }: LogsToggleButtonProps): JSX.Element {
  return (
    <div className="pointer-events-auto">
      <Button
        size="sm"
        variant="secondary"
        onClick={onToggle}
        className="h-10 rounded-full border border-white/20 bg-black/65 px-4 text-white hover:bg-black/80"
      >
        <ScrollText className="mr-2 h-4 w-4" />
        {isOpen ? "Hide Logs" : "Show Logs"}
      </Button>
    </div>
  );
}
