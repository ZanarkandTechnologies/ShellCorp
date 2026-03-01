import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ViewComputerDialog(props: {
  employeeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProjectId?: string | null;
}): JSX.Element {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Computer Session</DialogTitle>
        </DialogHeader>
        <p>Live computer view is not enabled in this MVP shell yet.</p>
        <p className="text-xs text-muted-foreground">
          employee: {props.employeeId} {props.initialProjectId ? `project: ${props.initialProjectId}` : ""}
        </p>
      </DialogContent>
    </Dialog>
  );
}
