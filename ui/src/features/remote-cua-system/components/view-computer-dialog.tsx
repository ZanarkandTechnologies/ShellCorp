import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Monitor, TerminalSquare, Code2, Logs, X, PlayCircle } from "lucide-react";
import { useState } from "react";

export function ViewComputerDialog(props: {
  employeeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProjectId?: string | null;
}): JSX.Element {
  const [viewMode, setViewMode] = useState<"auto" | "desktop" | "terminal" | "code" | "logs">("auto");

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="min-w-[90vw] max-w-[95vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background z-[1000] [&>button]:hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold">View Computer</h2>
            <Badge variant="secondary">employee: {props.employeeId}</Badge>
            {props.initialProjectId ? <Badge variant="outline">project: {props.initialProjectId}</Badge> : null}
          </div>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(value) => setViewMode(value as typeof viewMode)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="desktop">Desktop</SelectItem>
                <SelectItem value="terminal">Terminal</SelectItem>
                <SelectItem value="code">Code</SelectItem>
                <SelectItem value="logs">Logs</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" onClick={() => props.onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 border-r p-4">
            <div className="h-full rounded-md border bg-muted/20 flex flex-col items-center justify-center gap-3">
              {viewMode === "terminal" ? <TerminalSquare className="h-8 w-8 text-muted-foreground" /> : null}
              {viewMode === "code" ? <Code2 className="h-8 w-8 text-muted-foreground" /> : null}
              {viewMode === "logs" ? <Logs className="h-8 w-8 text-muted-foreground" /> : null}
              {viewMode === "desktop" || viewMode === "auto" ? <Monitor className="h-8 w-8 text-muted-foreground" /> : null}
              <p className="text-sm text-muted-foreground">Live computer stream will appear here.</p>
              <p className="text-xs text-muted-foreground">Parity UI restored; backend session wiring pending.</p>
            </div>
          </div>
          <div className="w-[360px] p-4">
            <div className="h-full rounded-md border bg-muted/10 p-3 flex flex-col gap-3">
              <div className="text-sm font-medium">Activity Timeline</div>
              <div className="flex-1 rounded-md border bg-background p-3 text-sm text-muted-foreground">
                No activity yet for this session.
              </div>
              <Button className="w-full gap-2" disabled>
                <PlayCircle className="h-4 w-4" />
                Send Manual Command
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
