"use client";

/**
 * USER TASKS PANEL
 * ================
 * Founder-facing review inbox for CEO board tasks that need a decision.
 *
 * KEY CONCEPTS:
 * - User Tasks is a filtered view over shared board tasks, not a separate workflow store.
 * - CEO proposal work is represented as `taskType=team_proposal` with lightweight task-local approval metadata.
 * - Founder actions only update task state/notes; CEO execution still happens through skills plus CLI.
 *
 * USAGE:
 * - Opened from the Office menu as the founder's review inbox.
 *
 * MEMORY REFERENCES:
 * - MEM-0155
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Bell, ClipboardList, Loader2, Terminal } from "lucide-react";

import { api } from "../../../../convex/_generated/api";
import { isConvexEnabled } from "@/providers/convex-provider";
import { useAppStore } from "@/lib/app-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { TaskApprovalState } from "@/features/team-system/components/team-panel-types";
import { TaskMemoryView } from "@/features/team-system/components/task-memory-view";
import {
  countSc12PendingReviewTasks,
  resolveSc12BoardTasks,
  type Sc12BoardTask,
} from "@/lib/sc12-board";

interface UserTasksPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function statusTone(task: ReviewTask): "secondary" | "destructive" | "outline" {
  if (task.approvalState === "rejected") return "destructive";
  if (task.approvalState === "approved" || task.approvalState === "executed") return "secondary";
  return "outline";
}

type ReviewTask = Sc12BoardTask;

function parseAgentIdFromSessionKey(sessionKey: string | undefined): string | null {
  const value = sessionKey?.trim() ?? "";
  if (!value) return null;
  const parts = value.split(":");
  return parts[1]?.trim() || null;
}

function appendFounderDecision(
  notes: string | undefined,
  state: TaskApprovalState,
  decisionNote: string,
): string {
  const trimmedBase = (notes ?? "").trim();
  const trimmedNote = decisionNote.trim();
  const auditLine = `Founder decision: ${state}${trimmedNote ? ` | ${trimmedNote}` : ""}`;
  if (!trimmedBase) return auditLine;
  return `${trimmedBase}\n\n${auditLine}`;
}

export function UserTasksPanel({ isOpen, onOpenChange }: UserTasksPanelProps): JSX.Element {
  const convexEnabled = isConvexEnabled();
  const boardCommand = useMutation(api.board.boardCommand);
  const companyBoard = useQuery(
    api.board.getCompanyBoardTasks,
    convexEnabled ? { taskType: "team_proposal" } : "skip",
  );
  const setActiveTeamId = useAppStore((state) => state.setActiveTeamId);
  const setIsTeamPanelOpen = useAppStore((state) => state.setIsTeamPanelOpen);
  const setSelectedAgentId = useAppStore((state) => state.setSelectedAgentId);
  const setSelectedSessionKey = useAppStore((state) => state.setSelectedSessionKey);
  const setIsAgentSessionPanelOpen = useAppStore((state) => state.setIsAgentSessionPanelOpen);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState("");

  const { tasks: reviewTasks, isMock } = useMemo(
    () =>
      resolveSc12BoardTasks({
        convexEnabled,
        hasLoaded: companyBoard !== undefined,
        rows: companyBoard?.tasks,
      }),
    [companyBoard, convexEnabled],
  );

  useEffect(() => {
    if (!isOpen) return;
    setSelectedTaskId((current) =>
      current && reviewTasks.some((task) => task.id === current)
        ? current
        : (reviewTasks[0]?.id ?? null),
    );
  }, [isOpen, reviewTasks]);

  const pendingReviewTasks = useMemo(
    () => reviewTasks.filter((task) => countSc12PendingReviewTasks([task]) > 0),
    [reviewTasks],
  );

  const selectedTask = useMemo(
    () => reviewTasks.find((task) => task.id === selectedTaskId) ?? null,
    [reviewTasks, selectedTaskId],
  );

  async function handleDecision(nextState: TaskApprovalState): Promise<void> {
    if (!selectedTask || !convexEnabled || selectedTask.isMock) return;
    setIsSubmitting(true);
    setStatusText("");
    try {
      await boardCommand({
        projectId: selectedTask.projectId,
        command: "task_update",
        taskId: selectedTask.id,
        approvalState: nextState,
        notes: appendFounderDecision(selectedTask.notes, nextState, decisionNote),
        actorType: "operator",
        actorAgentId: "founder-ui",
        label: `Founder set ${nextState}`,
      });
      setDecisionNote("");
      setStatusText(
        nextState === "approved"
          ? "Founder approval saved. CEO should now execute the task through the ShellCorp CLI skill."
          : nextState === "rejected"
            ? "Proposal rejected."
            : "Changes requested from the CEO task.",
      );
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "task_update_failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  const linkedAgentId = parseAgentIdFromSessionKey(selectedTask?.linkedSessionKey);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="z-[1000] flex h-[min(90vh,880px)] max-w-[96vw] flex-col overflow-hidden p-0 sm:max-w-[1200px]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            User Tasks
          </DialogTitle>
          <DialogDescription>
            Founder review is a filtered view over CEO board tasks waiting for approval, not a
            separate workflow store.
            {isMock
              ? " Showing mock tasks so the SC12 review flow stays visible before live board data exists."
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
          <ScrollArea className="border-r">
            <div className="space-y-4 p-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">CEO Task Flow</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    The CEO should research, draft, and update one board task, then wait for founder
                    approval on that same task.
                  </p>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                      <Terminal className="h-4 w-4" />
                      Expected task command
                    </div>
                    <code className="block whitespace-pre-wrap break-all text-xs">
                      npm run shell -- team board task add --team-id &lt;team-id&gt; --title
                      "&lt;proposal-title&gt;" --task-type team_proposal --approval-state
                      pending_review --linked-session-key agent:main:main --detail
                      "&lt;proposal-summary&gt;"
                    </code>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Inbox</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {reviewTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No CEO review tasks yet.</p>
                  ) : (
                    reviewTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        className={`w-full rounded-md border p-3 text-left transition hover:border-foreground/20 ${
                          selectedTaskId === task.id ? "border-primary bg-primary/5" : ""
                        }`}
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{task.title}</p>
                            <div className="mt-1">
                              <TaskMemoryView notes={task.notes} variant="compact" />
                            </div>
                          </div>
                          <Badge variant={statusTone(task)}>{task.approvalState ?? "draft"}</Badge>
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>

          <ScrollArea className="min-h-0">
            <div className="space-y-4 p-4">
              {selectedTask ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ClipboardList className="h-4 w-4" />
                      {selectedTask.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={statusTone(selectedTask)}>
                        {selectedTask.approvalState ?? "draft"}
                      </Badge>
                      <Badge variant="outline">status: {selectedTask.status}</Badge>
                      <Badge variant="outline">project: {selectedTask.projectId}</Badge>
                    </div>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Proposal / Task Memory</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <TaskMemoryView notes={selectedTask.notes} />
                      </CardContent>
                    </Card>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Session</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                          <p>{selectedTask.linkedSessionKey ?? "No linked session yet."}</p>
                          {linkedAgentId && selectedTask.linkedSessionKey ? (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedAgentId(linkedAgentId);
                                setSelectedSessionKey(selectedTask.linkedSessionKey ?? null);
                                setIsAgentSessionPanelOpen(true);
                              }}
                            >
                              Open linked session
                            </Button>
                          ) : null}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Execution Result</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <p>
                            <strong>Created team:</strong>{" "}
                            {selectedTask.createdTeamId ?? "not created"}
                          </p>
                          <p>
                            <strong>Created project:</strong>{" "}
                            {selectedTask.createdProjectId ?? "not created"}
                          </p>
                          {selectedTask.isMock ? (
                            <p className="text-muted-foreground">
                              Demo record only. Live team/project links appear once a real CEO board
                              task executes.
                            </p>
                          ) : null}
                          {selectedTask.createdTeamId && !selectedTask.isMock ? (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setActiveTeamId(selectedTask.createdTeamId ?? null);
                                setIsTeamPanelOpen(true);
                              }}
                            >
                              Open created team
                            </Button>
                          ) : null}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-1">
                      <Label>Founder Note</Label>
                      <Textarea
                        value={decisionNote}
                        onChange={(event) => setDecisionNote(event.target.value)}
                        placeholder="Optional approval feedback or change request"
                        className="min-h-[72px]"
                        disabled={isSubmitting || !convexEnabled || selectedTask.isMock}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => void handleDecision("approved")}
                        disabled={
                          isSubmitting ||
                          !convexEnabled ||
                          selectedTask.isMock ||
                          selectedTask.approvalState === "executed"
                        }
                      >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void handleDecision("changes_requested")}
                        disabled={isSubmitting || !convexEnabled || selectedTask.isMock}
                      >
                        Request Changes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void handleDecision("rejected")}
                        disabled={isSubmitting || !convexEnabled || selectedTask.isMock}
                      >
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Select a CEO review task after the CEO creates it on the shared board path.
                </div>
              )}

              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                {pendingReviewTasks.length} task{pendingReviewTasks.length === 1 ? "" : "s"} waiting
                for founder review.
              </div>

              {statusText ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                  {statusText}
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
