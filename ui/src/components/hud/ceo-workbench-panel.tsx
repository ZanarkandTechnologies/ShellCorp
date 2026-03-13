"use client";

/**
 * CEO WORKBENCH PANEL
 * ===================
 * Board-native CEO workspace with integrated human review.
 *
 * KEY CONCEPTS:
 * - Human review lives on the same board surface instead of a separate inbox.
 * - Cards preview compact state while a centered modal holds the full task memory page.
 *
 * USAGE:
 * - Mounted from `office-simulation.tsx`.
 *
 * MEMORY REFERENCES:
 * - MEM-0155
 * - MEM-0160
 */

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  MessageSquare,
  Sparkles,
  XCircle,
} from "lucide-react";

import { api } from "../../../../convex/_generated/api";
import { CeoTaskDetailModal } from "./ceo-task-detail-modal";
import { useAppStore } from "@/lib/app-store";
import { useChatActions } from "@/features/chat-system/chat-store";
import { TaskMemoryView } from "@/features/team-system/components/task-memory-view";
import { isConvexEnabled } from "@/providers/convex-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  countSc12PendingReviewTasks,
  resolveSc12BoardTasks,
  type Sc12BoardTask,
} from "@/lib/sc12-board";

type TaskLaneKey = "drafting" | "awaiting_review" | "approved" | "executed" | "rejected";

type TaskLane = {
  key: TaskLaneKey;
  label: string;
  description: string;
  tasks: Sc12BoardTask[];
};

function groupTaskLane(task: Sc12BoardTask): TaskLaneKey {
  if (task.createdTeamId || task.createdProjectId || task.approvalState === "executed")
    return "executed";
  if (task.approvalState === "rejected") return "rejected";
  if (task.approvalState === "approved") return "approved";
  if (task.approvalState === "pending_review" || task.approvalState === "changes_requested")
    return "awaiting_review";
  return "drafting";
}

function formatProjectLabel(projectId: string): string {
  return projectId
    .replace(/^proj-/, "")
    .split("-")
    .map((part) =>
      part.length <= 2 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

function lanePalette(key: TaskLaneKey): string {
  if (key === "awaiting_review") return "border-primary/50";
  if (key === "approved") return "border-secondary/50";
  if (key === "executed") return "border-foreground/20";
  if (key === "rejected") return "border-destructive/40";
  return "border-border";
}

function laneAccent(key: TaskLaneKey): string {
  if (key === "awaiting_review") return "text-primary";
  if (key === "approved") return "text-secondary";
  if (key === "executed") return "text-foreground";
  if (key === "rejected") return "text-destructive";
  return "text-muted-foreground";
}

function chipTone(task: Sc12BoardTask, type: "approval" | "status"): string {
  const value = type === "approval" ? task.approvalState : task.status;
  if (value === "approved" || value === "executed" || value === "done")
    return "border-secondary/40 bg-secondary/10 text-foreground";
  if (value === "pending_review" || value === "in_progress")
    return "border-primary/40 bg-primary/10 text-foreground";
  if (value === "changes_requested") return "border-primary/40 bg-accent text-foreground";
  if (value === "rejected" || value === "blocked")
    return "border-destructive/40 bg-destructive/10 text-foreground";
  return "border-border bg-muted/40 text-muted-foreground";
}

function laneStatusIcon(key: TaskLaneKey): JSX.Element {
  if (key === "approved" || key === "executed") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (key === "rejected") return <XCircle className="h-3.5 w-3.5" />;
  return <Clock3 className="h-3.5 w-3.5" />;
}

export function CeoWorkbenchPanel(): JSX.Element {
  const { openEmployeeChat } = useChatActions();
  const isOpen = useAppStore((state) => state.isCeoWorkbenchOpen);
  const setIsOpen = useAppStore((state) => state.setIsCeoWorkbenchOpen);
  const view = useAppStore((state) => state.ceoWorkbenchView);
  const setView = useAppStore((state) => state.setCeoWorkbenchView);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const convexEnabled = isConvexEnabled();
  const companyBoard = useQuery(
    api.board.getCompanyBoardTasks,
    convexEnabled ? { taskType: "team_proposal" } : "skip",
  );

  const { tasks, isMock } = useMemo(
    () =>
      resolveSc12BoardTasks({
        convexEnabled,
        hasLoaded: companyBoard !== undefined,
        rows: companyBoard?.tasks,
      }),
    [companyBoard, convexEnabled],
  );

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  const lanes = useMemo<TaskLane[]>(() => {
    const ordered: Array<{ key: TaskLaneKey; label: string; description: string }> = [
      { key: "drafting", label: "Drafting", description: "CEO still shaping the brief" },
      { key: "awaiting_review", label: "Review", description: "Needs human sign-off or revision" },
      { key: "approved", label: "Approved", description: "Ready for CEO execution" },
      { key: "executed", label: "Executed", description: "Completed and linked forward" },
      { key: "rejected", label: "Rejected", description: "Stopped or closed out" },
    ];
    return ordered.map((lane) => ({
      ...lane,
      tasks: tasks.filter((task) => groupTaskLane(task) === lane.key),
    }));
  }, [tasks]);

  const reviewTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.approvalState === "pending_review" || task.approvalState === "changes_requested",
      ),
    [tasks],
  );

  const pendingReviewCount = countSc12PendingReviewTasks(tasks);
  const visibleLanes =
    view === "review" ? lanes.filter((lane) => lane.key === "awaiting_review") : lanes;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        setIsOpen(nextOpen);
        if (!nextOpen) setSelectedTaskId(null);
      }}
    >
      <DialogContent className="z-[1000] flex h-[min(92vh,920px)] max-w-[96vw] flex-col overflow-hidden border border-border bg-background p-0 text-foreground shadow-2xl sm:max-w-[1520px]">
        <DialogHeader className="border-b border-border bg-card px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-3">
              <DialogTitle className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-foreground">
                <BriefcaseBusiness className="h-5 w-5 text-muted-foreground" />
                CEO Workbench
              </DialogTitle>
              <DialogDescription className="max-w-4xl text-sm leading-7 text-muted-foreground">
                Shared board-native workspace for CEO tasks and human review. Open any card to read
                the full task memory page and approve or redirect work in place.
                {isMock ? " Using demo tasks until live board data lands." : ""}
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              className="h-10 rounded-none border-border bg-background px-4 text-sm shadow-none"
              onClick={() => {
                setIsOpen(false);
                void openEmployeeChat("employee-main", true);
              }}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Open CEO Chat
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                aria-pressed={view === "board"}
                className={`h-10 border px-4 text-sm uppercase tracking-wide transition ${
                  view === "board"
                    ? "border-foreground/20 bg-accent text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
                onClick={() => setView("board")}
              >
                Board View
              </button>
              <button
                type="button"
                aria-pressed={view === "review"}
                className={`h-10 border px-4 text-sm uppercase tracking-wide transition ${
                  view === "review"
                    ? "border-foreground/20 bg-accent text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
                onClick={() => setView("review")}
              >
                Human Review
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Badge
                variant="outline"
                className="rounded-none border-border bg-background text-foreground shadow-none"
              >
                {tasks.length} CEO tasks
              </Badge>
              <Badge
                variant="outline"
                className="rounded-none border-border bg-card text-foreground shadow-none"
              >
                {pendingReviewCount} waiting for human review
              </Badge>
              {view === "review" ? (
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Clock3 className="h-4 w-4" />
                  Reviewing {reviewTasks.length} tasks across the shared board
                </span>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div
            className={`grid min-h-full gap-4 p-6 ${view === "review" ? "xl:grid-cols-1" : "xl:grid-cols-5"}`}
          >
            {visibleLanes.map((lane) => (
              <section key={lane.key} className={`border bg-card ${lanePalette(lane.key)} p-4`}>
                <div className="mb-4 space-y-2 border-b border-border pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className={laneAccent(lane.key)}>{laneStatusIcon(lane.key)}</span>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
                        {lane.label}
                      </h3>
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-none border-border bg-background text-muted-foreground shadow-none"
                    >
                      {lane.tasks.length}
                    </Badge>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">{lane.description}</p>
                </div>

                <div className="space-y-3">
                  {lane.tasks.length === 0 ? (
                    <div className="border border-dashed border-border bg-background p-4 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      No tasks in this lane.
                    </div>
                  ) : (
                    lane.tasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => setSelectedTaskId(task.id)}
                        className="group w-full border border-border bg-background p-4 text-left transition hover:bg-accent/60"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-base font-semibold leading-6 tracking-tight text-foreground">
                              {task.title}
                            </p>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                              {formatProjectLabel(task.projectId)}
                            </p>
                          </div>
                          {task.createdTeamId ? (
                            <Sparkles className="mt-1 h-4 w-4 shrink-0 text-secondary" />
                          ) : null}
                        </div>

                        <div className="mt-4">
                          <TaskMemoryView notes={task.notes} variant="compact" />
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-2">
                          <span
                            className={`border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${chipTone(task, "approval")}`}
                          >
                            {(task.approvalState ?? "draft").replace(/_/g, " ")}
                          </span>
                          <span
                            className={`border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${chipTone(task, "status")}`}
                          >
                            {task.status.replace(/_/g, " ")}
                          </span>
                          {task.isMock ? (
                            <span className="border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                              mock
                            </span>
                          ) : null}
                          <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition group-hover:text-foreground">
                            Open
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        </ScrollArea>

        <CeoTaskDetailModal
          task={selectedTask}
          open={selectedTask !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setSelectedTaskId(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
