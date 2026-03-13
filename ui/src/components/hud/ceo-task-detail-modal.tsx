"use client";

/**
 * CEO TASK DETAIL MODAL
 * =====================
 * Centered detail view for board-native CEO tasks and human review actions.
 *
 * KEY CONCEPTS:
 * - Opens above the workbench so task memory feels like a focused Notion-style page.
 * - Keeps human review actions attached to the same underlying board task.
 *
 * USAGE:
 * - Mounted from `ceo-workbench-panel.tsx`.
 *
 * MEMORY REFERENCES:
 * - MEM-0155
 * - MEM-0160
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  MessageSquareText,
  XCircle,
} from "lucide-react";

import { api } from "../../../../convex/_generated/api";
import { TaskMemoryView } from "@/features/team-system/components/task-memory-view";
import type { Sc12BoardTask } from "@/lib/sc12-board";
import { UI_Z } from "@/lib/z-index";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

type CeoTaskDetailModalProps = {
  task: Sc12BoardTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatProjectLabel(projectId: string): string {
  return projectId
    .replace(/^proj-/, "")
    .split("-")
    .map((part) =>
      part.length <= 2 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

function approvalTone(state: string | undefined): string {
  if (state === "approved" || state === "executed")
    return "border-secondary/40 bg-secondary/10 text-foreground";
  if (state === "changes_requested") return "border-primary/40 bg-accent text-foreground";
  if (state === "rejected") return "border-destructive/40 bg-destructive/10 text-foreground";
  return "border-border bg-muted/40 text-muted-foreground";
}

function statusTone(status: string): string {
  if (status === "done") return "border-secondary/40 bg-secondary/10 text-foreground";
  if (status === "blocked") return "border-destructive/40 bg-destructive/10 text-foreground";
  if (status === "in_progress") return "border-primary/40 bg-primary/10 text-foreground";
  return "border-border bg-muted/40 text-muted-foreground";
}

function appendHumanDecision(
  notes: string | undefined,
  state: string,
  decisionNote: string,
): string {
  const base = (notes ?? "").trim();
  const detail = decisionNote.trim();
  const line = `Human review: ${state}${detail ? ` | ${detail}` : ""}`;
  return base ? `${base}\n\n${line}` : line;
}

export function CeoTaskDetailModal({
  task,
  open,
  onOpenChange,
}: CeoTaskDetailModalProps): JSX.Element {
  const boardCommand = useMutation(api.board.boardCommand);
  const [decisionNote, setDecisionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState("");

  const projectLabel = useMemo(() => (task ? formatProjectLabel(task.projectId) : ""), [task]);

  useEffect(() => {
    setDecisionNote("");
    setStatusText("");
  }, [task?.id]);

  async function handleDecision(
    nextState: "approved" | "changes_requested" | "rejected",
  ): Promise<void> {
    if (!task || task.isMock) return;
    setIsSubmitting(true);
    setStatusText("");
    try {
      await boardCommand({
        projectId: task.projectId,
        command: "task_update",
        taskId: task.id,
        approvalState: nextState,
        notes: appendHumanDecision(task.notes, nextState, decisionNote),
        actorType: "operator",
        actorAgentId: "human-review",
        label: `Human review set ${nextState}`,
      });
      setDecisionNote("");
      setStatusText(
        nextState === "approved"
          ? "Human approval saved on the board task."
          : nextState === "rejected"
            ? "Task marked rejected."
            : "Task sent back with requested changes.",
      );
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "task_update_failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!task) return <></>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-[min(1380px,96vw)] overflow-hidden border border-border bg-background p-0 text-foreground shadow-2xl"
        style={{ zIndex: UI_Z.panelModal }}
        overlayStyle={{
          zIndex: UI_Z.panelModal - 1,
          backgroundColor: "hsl(var(--background) / 0.82)",
        }}
      >
        <DialogHeader className="border-b border-border bg-card px-8 py-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={`rounded-none border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${approvalTone(task.approvalState)} shadow-none`}
            >
              {task.approvalState?.replace(/_/g, " ") ?? "draft"}
            </Badge>
            <Badge
              variant="outline"
              className={`rounded-none border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${statusTone(task.status)} shadow-none`}
            >
              {task.status.replace(/_/g, " ")}
            </Badge>
            <Badge
              variant="outline"
              className="rounded-none border-border bg-background px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {projectLabel}
            </Badge>
            {task.isMock ? (
              <Badge
                variant="outline"
                className="rounded-none border-border bg-background px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
              >
                mock
              </Badge>
            ) : null}
          </div>
          <DialogTitle className="max-w-5xl text-4xl font-semibold leading-tight tracking-tight text-foreground xl:text-5xl">
            {task.title}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              Linked session: {task.linkedSessionKey ?? "none"}
            </span>
            {task.createdTeamId ? (
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-secondary" />
                Created team: {task.createdTeamId}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <ScrollArea className="min-h-0 border-r border-border">
            <div className="space-y-6 px-8 py-8 xl:px-10">
              <TaskMemoryView notes={task.notes} variant="full" />
            </div>
          </ScrollArea>

          <div className="space-y-6 bg-card px-6 py-8">
            <div className="space-y-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Review
              </div>
              <div className="border border-border bg-background p-4">
                <Label className="text-foreground">Human note</Label>
                <Textarea
                  value={decisionNote}
                  onChange={(event) => setDecisionNote(event.target.value)}
                  placeholder="Write review guidance directly on the shared task."
                  className="mt-3 min-h-[132px] rounded-none border-border bg-background text-sm text-foreground shadow-none"
                  disabled={isSubmitting || task.isMock}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    className="h-10 rounded-none px-4 text-sm"
                    disabled={isSubmitting || task.isMock || task.approvalState === "executed"}
                    onClick={() => void handleDecision("approved")}
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 rounded-none border-border bg-background px-4 text-sm shadow-none"
                    disabled={isSubmitting || task.isMock}
                    onClick={() => void handleDecision("changes_requested")}
                  >
                    <MessageSquareText className="mr-2 h-4 w-4" />
                    Request Changes
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 rounded-none border-border bg-background px-4 text-sm shadow-none"
                    disabled={isSubmitting || task.isMock}
                    onClick={() => void handleDecision("rejected")}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>
              {statusText ? (
                <div className="border border-border bg-background p-4 text-sm text-muted-foreground">
                  {statusText}
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Context
              </div>
              <div className="space-y-3 border border-border bg-background p-4 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Owner:</span>{" "}
                  {task.ownerAgentId ?? "unassigned"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Priority:</span> {task.priority}
                </p>
                <p>
                  <span className="font-medium text-foreground">Project:</span> {projectLabel}
                </p>
                {task.providerUrl ? (
                  <a
                    href={task.providerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:text-primary/80"
                  >
                    Open external task
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
