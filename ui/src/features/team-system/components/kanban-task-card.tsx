"use client";

/**
 * KANBAN TASK CARD
 * ================
 * Compact Notion-style task card for display in a kanban column.
 *
 * KEY CONCEPTS:
 * - No inline edit controls; all edits go through the detail modal.
 * - Priority is color-coded via badge: high=red, medium=amber, low=green.
 * - Clicking anywhere on the card opens the task detail modal.
 *
 * USAGE:
 * - Render inside KanbanColumn, passing onOpen to surface the detail modal.
 */

import { Badge } from "@/components/ui/badge";
import { TaskMemoryView } from "./task-memory-view";
import { type PanelTask, PRIORITY_COLORS } from "./team-panel-types";

interface KanbanTaskCardProps {
  task: PanelTask;
  ownerLabel: string;
  onOpen: (task: PanelTask) => void;
}

export function KanbanTaskCard({ task, ownerLabel, onOpen }: KanbanTaskCardProps): JSX.Element {
  const approvalTone =
    task.approvalState === "approved" || task.approvalState === "executed"
      ? "border-emerald-500/30 bg-emerald-500/10 text-foreground"
      : task.approvalState === "pending_review"
        ? "border-amber-500/30 bg-amber-500/10 text-foreground"
        : task.approvalState === "changes_requested"
          ? "border-primary/40 bg-accent text-foreground"
          : task.approvalState === "rejected"
            ? "border-destructive/40 bg-destructive/10 text-foreground"
            : "border-border bg-muted/40 text-muted-foreground";

  return (
    <button
      type="button"
      className="group w-full cursor-pointer border border-border bg-background p-4 text-left transition hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onOpen(task)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-base font-semibold leading-6 tracking-tight text-foreground">
            {task.title}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {ownerLabel}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <TaskMemoryView notes={task.notes} variant="compact" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={`rounded-none text-[10px] font-medium uppercase tracking-[0.16em] shadow-none ${PRIORITY_COLORS[task.priority]}`}
        >
          {task.priority}
        </Badge>
        {task.approvalState ? (
          <span
            className={`border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${approvalTone}`}
          >
            {task.approvalState.replace(/_/g, " ")}
          </span>
        ) : null}

        {task.provider !== "internal" ? (
          <Badge variant="secondary" className="rounded-none text-[10px] uppercase shadow-none">
            {task.provider}
          </Badge>
        ) : null}

        {task.syncState !== "healthy" ? (
          <Badge
            variant="outline"
            className={
              task.syncState === "error"
                ? "rounded-none border-red-500/40 text-[10px] text-red-500 shadow-none"
                : "rounded-none border-amber-500/40 text-[10px] text-amber-500 shadow-none"
            }
          >
            {task.syncState}
          </Badge>
        ) : null}
      </div>
    </button>
  );
}
