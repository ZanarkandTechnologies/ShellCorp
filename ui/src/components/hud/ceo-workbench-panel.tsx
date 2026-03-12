"use client";

/**
 * CEO WORKBENCH PANEL
 * ===================
 * CEO-facing board-native workflow surface for team-generation tasks.
 *
 * KEY CONCEPTS:
 * - Reuses Convex board tasks with lightweight CEO metadata instead of a proposal-specific store.
 * - Shows the same task objects that Founder review sees in User Tasks, grouped into workflow lanes.
 *
 * USAGE:
 * - Mounted from `office-simulation.tsx`.
 *
 * MEMORY REFERENCES:
 * - MEM-0155
 */

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { BriefcaseBusiness, ClipboardList, MessageSquare, Rocket } from "lucide-react";

import { api } from "../../../../convex/_generated/api";
import { useAppStore } from "@/lib/app-store";
import { useChatActions } from "@/features/chat-system/chat-store";
import { isConvexEnabled } from "@/providers/convex-provider";
import type { PanelTask } from "@/features/team-system/components/team-panel-types";
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

type WorkbenchTask = PanelTask & { projectId: string };
type TaskLaneKey = "drafting" | "awaiting_review" | "approved" | "executed" | "rejected";

type TaskLane = {
  key: TaskLaneKey;
  label: string;
  tasks: WorkbenchTask[];
};

function groupTaskLane(task: WorkbenchTask): TaskLaneKey {
  if (task.createdTeamId || task.createdProjectId || task.approvalState === "executed")
    return "executed";
  if (task.approvalState === "rejected") return "rejected";
  if (task.approvalState === "approved") return "approved";
  if (task.approvalState === "pending_review" || task.approvalState === "changes_requested")
    return "awaiting_review";
  return "drafting";
}

export function CeoWorkbenchPanel(): JSX.Element {
  const { openEmployeeChat } = useChatActions();
  const isOpen = useAppStore((state) => state.isCeoWorkbenchOpen);
  const setIsOpen = useAppStore((state) => state.setIsCeoWorkbenchOpen);
  const setIsUserTasksOpen = useAppStore((state) => state.setIsUserTasksModalOpen);
  const convexEnabled = isConvexEnabled();
  const companyBoard = useQuery(
    api.board.getCompanyBoardTasks,
    convexEnabled ? { taskType: "team_proposal" } : "skip",
  );

  const tasks = useMemo<WorkbenchTask[]>(
    () =>
      (companyBoard?.tasks ?? []).map((task) => ({
        id: task.taskId,
        projectId: task.projectId,
        title: task.title,
        status: task.status as PanelTask["status"],
        ownerAgentId: task.ownerAgentId,
        priority: (task.priority as PanelTask["priority"]) ?? "medium",
        provider: (task.provider as PanelTask["provider"]) ?? "internal",
        providerUrl: task.providerUrl,
        syncState: (task.syncState as PanelTask["syncState"]) ?? "healthy",
        syncError: task.syncError,
        notes: task.notes,
        taskType: task.taskType as PanelTask["taskType"],
        approvalState: task.approvalState as PanelTask["approvalState"],
        linkedSessionKey: task.linkedSessionKey,
        createdTeamId: task.createdTeamId,
        createdProjectId: task.createdProjectId,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        dueAt: task.dueAt,
      })),
    [companyBoard?.tasks],
  );

  const lanes = useMemo<TaskLane[]>(() => {
    const ordered: Array<{ key: TaskLaneKey; label: string }> = [
      { key: "drafting", label: "Drafting" },
      { key: "awaiting_review", label: "Waiting Review" },
      { key: "approved", label: "Approved" },
      { key: "executed", label: "Executed" },
      { key: "rejected", label: "Rejected" },
    ];
    return ordered.map((lane) => ({
      ...lane,
      tasks: tasks.filter((task) => groupTaskLane(task) === lane.key),
    }));
  }, [tasks]);

  const pendingReviewCount = tasks.filter(
    (task) => task.approvalState === "pending_review" || task.approvalState === "changes_requested",
  ).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="z-[1000] flex h-[min(90vh,840px)] max-w-[96vw] flex-col overflow-hidden p-0 sm:max-w-[1280px]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <BriefcaseBusiness className="h-4 w-4 text-primary" />
            CEO Workbench
          </DialogTitle>
          <DialogDescription>
            CEO board tasks grouped into workflow lanes. This surface reads the same task records as
            founder review.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 border-b px-6 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{tasks.length} CEO tasks</Badge>
            <Badge variant={pendingReviewCount > 0 ? "secondary" : "outline"}>
              {pendingReviewCount} waiting founder review
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                setIsUserTasksOpen(true);
              }}
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              Open User Tasks
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                void openEmployeeChat("employee-main", true);
              }}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Open CEO Chat
            </Button>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="grid min-h-full gap-4 p-4 lg:grid-cols-5">
            {lanes.map((lane) => (
              <div key={lane.key} className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{lane.label}</h3>
                  <Badge variant="outline">{lane.tasks.length}</Badge>
                </div>
                <div className="space-y-3">
                  {!convexEnabled ? (
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      Convex board data is required for the CEO board.
                    </div>
                  ) : lane.tasks.length === 0 ? (
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      No tasks in this lane.
                    </div>
                  ) : (
                    lane.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-md border bg-background p-3 text-sm shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{task.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{task.projectId}</p>
                          </div>
                          {task.createdTeamId ? (
                            <Rocket className="mt-0.5 h-4 w-4 text-emerald-500" />
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
                          {task.notes ?? "No task memory yet."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline">{task.approvalState ?? "draft"}</Badge>
                          <Badge variant="outline">{task.status}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
