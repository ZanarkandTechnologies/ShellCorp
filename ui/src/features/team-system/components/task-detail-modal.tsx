"use client";

/**
 * TASK DETAIL MODAL
 * =================
 * Full CRUD task detail view in a Dialog for the Team Kanban board.
 *
 * KEY CONCEPTS:
 * - Inline editable title (click to edit pattern).
 * - Dropdowns for status, priority, and assignee.
 * - Notes textarea mapped to task_update with detail/notes.
 * - Action buttons use boardCommand mutation via onCommand callback.
 * - Reviewable tasks expose human review actions without leaving the Team Panel.
 * - Separate "Delete" button with a confirm step to prevent accidents.
 *
 * USAGE:
 * - Open from KanbanTaskCard click; driven by selectedTask state in KanbanTab.
 */

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/lib/app-store";
import { UI_Z } from "@/lib/z-index";
import { TaskMemoryView } from "./task-memory-view";
import {
  isTaskInReviewLane,
  type PanelTask,
  PRIORITY_COLORS,
  STATUS_COLORS,
  type TaskPriority,
  type TaskStatus,
} from "./team-panel-types";

type EmployeeOption = {
  id: string;
  name: string;
};

interface TaskDetailModalProps {
  task: PanelTask | null;
  isOpen: boolean;
  onClose: () => void;
  employees: EmployeeOption[];
  ownerLabelById: Map<string, string>;
  convexEnabled: boolean;
  isPending: boolean;
  onCommand: (
    command: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ) => Promise<void>;
}

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

function formatDate(ts: number | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function parseAgentIdFromSessionKey(sessionKey: string | undefined): string | null {
  const value = sessionKey?.trim() ?? "";
  if (!value) return null;
  const parts = value.split(":");
  return parts[1]?.trim() || null;
}

export function TaskDetailModal({
  task,
  isOpen,
  onClose,
  employees,
  ownerLabelById,
  convexEnabled,
  isPending,
  onCommand,
}: TaskDetailModalProps): JSX.Element {
  const setSelectedAgentId = useAppStore((state) => state.setSelectedAgentId);
  const setSelectedSessionKey = useAppStore((state) => state.setSelectedSessionKey);
  const setIsAgentSessionPanelOpen = useAppStore((state) => state.setIsAgentSessionPanelOpen);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [notesChanged, setNotesChanged] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewStatusText, setReviewStatusText] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (task) {
      setTitleDraft(task.title);
      setNotesDraft(task.notes ?? "");
      setNotesChanged(false);
      setConfirmDelete(false);
      setEditingTitle(false);
      setReviewNote("");
      setReviewStatusText("");
    }
  }, [task]);

  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  if (!task) return null;

  function handleSaveTitle(): void {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === task?.title) {
      setEditingTitle(false);
      return;
    }
    void onCommand("task_update", { taskId: task?.id, title: trimmed }, "Title updated.").then(() =>
      setEditingTitle(false),
    );
  }

  function handleSaveNotes(): void {
    void onCommand("task_update", { taskId: task?.id, detail: notesDraft }, "Notes saved.").then(
      () => setNotesChanged(false),
    );
  }

  function handleStatusChange(value: string): void {
    const cmdMap: Record<string, string> = {
      done: "task_done",
      blocked: "task_block",
      todo: "task_reopen",
      in_progress: "task_move",
    };
    const cmd = cmdMap[value] ?? "task_move";
    void onCommand(cmd, { taskId: task?.id, status: value }, `Moved to ${value}.`);
  }

  function handlePriorityChange(value: string): void {
    void onCommand(
      "task_reprioritize",
      { taskId: task?.id, priority: value },
      `Priority set to ${value}.`,
    );
  }

  function handleAssigneeChange(value: string): void {
    void onCommand(
      "task_assign",
      { taskId: task?.id, ownerAgentId: value || undefined },
      value ? `Assigned to ${ownerLabelById.get(value) ?? value}.` : "Unassigned.",
    );
  }

  function handleDelete(): void {
    void onCommand("task_delete", { taskId: task?.id }, "Task deleted.").then(onClose);
  }

  function appendReviewDecision(
    notes: string | undefined,
    nextState: "approved" | "changes_requested" | "rejected",
    note: string,
  ): string {
    const base = (notes ?? "").trim();
    const detail = note.trim();
    const line = `Human review: ${nextState}${detail ? ` | ${detail}` : ""}`;
    return base ? `${base}\n\n${line}` : line;
  }

  async function handleReviewDecision(
    nextState: "approved" | "changes_requested" | "rejected",
  ): Promise<void> {
    if (!task) return;
    setReviewStatusText("");
    try {
      await onCommand(
        "task_update",
        {
          taskId: task.id,
          approvalState: nextState,
          notes: appendReviewDecision(notesDraft, nextState, reviewNote),
        },
        nextState === "approved"
          ? "Review approved."
          : nextState === "rejected"
            ? "Task rejected."
            : "Changes requested.",
      );
      setNotesDraft((current) => appendReviewDecision(current, nextState, reviewNote));
      setNotesChanged(false);
      setReviewNote("");
      setReviewStatusText(
        nextState === "approved"
          ? "Human approval saved on the board task."
          : nextState === "rejected"
            ? "Task marked rejected."
            : "Task sent back with requested changes.",
      );
    } catch (error) {
      setReviewStatusText(error instanceof Error ? error.message : "task_update_failed");
    }
  }

  const currentOwnerLabel = task.ownerAgentId
    ? (ownerLabelById.get(task.ownerAgentId) ?? task.ownerAgentId)
    : "unassigned";
  const linkedAgentId = parseAgentIdFromSessionKey(task.linkedSessionKey);
  const showReviewActions = convexEnabled && isTaskInReviewLane(task);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-[min(96vw,1100px)] border border-border bg-background p-0"
        style={{ zIndex: UI_Z.panelModal }}
        overlayStyle={{ zIndex: UI_Z.panelModal - 1 }}
      >
        <DialogHeader className="border-b border-border bg-card px-6 py-5">
          <DialogTitle className="sr-only">Task Detail</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          {/* Title */}
          <div>
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  ref={titleInputRef}
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                  onBlur={handleSaveTitle}
                />
              </div>
            ) : (
              <button
                type="button"
                className="w-full rounded-md px-1 py-0.5 text-left text-base font-semibold hover:bg-muted/40"
                onClick={() => setEditingTitle(true)}
                title="Click to edit title"
              >
                {task.title}
              </button>
            )}
            <p className="mt-0.5 pl-1 text-[11px] text-muted-foreground">Click title to edit</p>
          </div>

          {/* Status + Priority + Assignee grid */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</p>
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${STATUS_COLORS[task.status]}`}
                />
                <select
                  className="rounded-md border bg-background px-2 py-1 text-xs"
                  value={task.status}
                  disabled={isPending}
                  onChange={(e) => handleStatusChange(e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Priority</p>
              <select
                className="rounded-md border bg-background px-2 py-1 text-xs"
                value={task.priority}
                disabled={isPending}
                onChange={(e) => handlePriorityChange(e.target.value)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Assignee</p>
              <select
                className="rounded-md border bg-background px-2 py-1 text-xs"
                value={task.ownerAgentId ?? ""}
                disabled={isPending}
                onChange={(e) => handleAssigneeChange(e.target.value)}
              >
                <option value="">unassigned</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={`rounded-none text-[10px] shadow-none ${PRIORITY_COLORS[task.priority]}`}
            >
              {task.priority}
            </Badge>
            <span className="text-xs text-muted-foreground">Assigned to: {currentOwnerLabel}</span>
            {task.dueAt ? (
              <span className="text-xs text-muted-foreground">Due: {formatDate(task.dueAt)}</span>
            ) : null}
            {task.taskType ? (
              <Badge variant="outline" className="rounded-none text-[10px] shadow-none">
                {task.taskType.replace(/_/g, " ")}
              </Badge>
            ) : null}
            {task.approvalState ? (
              <Badge variant="outline" className="rounded-none text-[10px] shadow-none">
                approval: {task.approvalState.replace(/_/g, " ")}
              </Badge>
            ) : null}
          </div>

          {showReviewActions ? (
            <div className="space-y-3 border border-border bg-card p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Review
              </p>
              <Textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Write review guidance directly on the shared task."
                className="min-h-24 rounded-none border-border bg-background text-sm"
                disabled={isPending}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() => void handleReviewDecision("approved")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-none border-border bg-background shadow-none"
                  disabled={isPending}
                  onClick={() => void handleReviewDecision("changes_requested")}
                >
                  Request Changes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-none border-border bg-background shadow-none"
                  disabled={isPending}
                  onClick={() => void handleReviewDecision("rejected")}
                >
                  Reject
                </Button>
              </div>
              {reviewStatusText ? (
                <div className="border border-border bg-background p-3 text-sm text-muted-foreground">
                  {reviewStatusText}
                </div>
              ) : null}
            </div>
          ) : null}

          {task.linkedSessionKey || task.createdTeamId || task.createdProjectId ? (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
              {task.linkedSessionKey ? (
                <div className="space-y-2">
                  <p>
                    <span className="font-medium text-foreground">Linked session:</span>{" "}
                    {task.linkedSessionKey}
                  </p>
                  {linkedAgentId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedAgentId(linkedAgentId);
                        setSelectedSessionKey(task.linkedSessionKey ?? null);
                        setIsAgentSessionPanelOpen(true);
                      }}
                    >
                      Open linked session
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {task.createdTeamId ? (
                <p>
                  <span className="font-medium text-foreground">Created team:</span>{" "}
                  {task.createdTeamId}
                </p>
              ) : null}
              {task.createdProjectId ? (
                <p>
                  <span className="font-medium text-foreground">Created project:</span>{" "}
                  {task.createdProjectId}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Notes */}
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Task Memory</p>
            <TaskMemoryView notes={task.notes} variant="compact" />
            <Textarea
              value={notesDraft}
              onChange={(e) => {
                setNotesDraft(e.target.value);
                setNotesChanged(true);
              }}
              placeholder="Add current state, blockers, next step, links, or other working memory..."
              className="min-h-24 text-sm"
            />
            {notesChanged ? (
              <Button size="sm" variant="secondary" onClick={handleSaveNotes} disabled={isPending}>
                {isPending ? "Saving..." : "Save Task Memory"}
              </Button>
            ) : null}
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <div>
              <span className="uppercase tracking-wide">Created</span>
              <br />
              {formatDate(task.createdAt)}
            </div>
            <div>
              <span className="uppercase tracking-wide">Updated</span>
              <br />
              {formatDate(task.updatedAt)}
            </div>
          </div>

          {/* Quick action buttons */}
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            {task.status !== "done" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  void onCommand("task_done", { taskId: task.id }, "Marked done.").then(onClose)
                }
              >
                Mark Done
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  void onCommand("task_reopen", { taskId: task.id }, "Reopened.").then(onClose)
                }
              >
                Reopen
              </Button>
            )}
            {task.status !== "blocked" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  void onCommand("task_block", { taskId: task.id }, "Blocked.").then(onClose)
                }
              >
                Block
              </Button>
            ) : null}

            <div className="ml-auto">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-destructive">Delete?</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isPending}
                    onClick={handleDelete}
                  >
                    Confirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
