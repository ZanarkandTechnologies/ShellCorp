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
import { PRIORITY_COLORS, type PanelTask } from "./team-panel-types";

interface KanbanTaskCardProps {
  task: PanelTask;
  ownerLabel: string;
  onOpen: (task: PanelTask) => void;
}

export function KanbanTaskCard({ task, ownerLabel, onOpen }: KanbanTaskCardProps): JSX.Element {
  return (
    <button
      type="button"
      className="group w-full cursor-pointer rounded-lg border bg-card p-3 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onOpen(task)}
    >
      <p className="mb-2 line-clamp-2 text-sm font-medium leading-snug">{task.title}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className={`text-[10px] font-medium uppercase tracking-wide ${PRIORITY_COLORS[task.priority]}`}
        >
          {task.priority}
        </Badge>

        <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
          {ownerLabel}
        </span>

        {task.provider !== "internal" ? (
          <Badge variant="secondary" className="text-[10px] uppercase">
            {task.provider}
          </Badge>
        ) : null}

        {task.syncState !== "healthy" ? (
          <Badge
            variant="outline"
            className={
              task.syncState === "error"
                ? "border-red-500/40 text-[10px] text-red-500"
                : "border-amber-500/40 text-[10px] text-amber-500"
            }
          >
            {task.syncState}
          </Badge>
        ) : null}
      </div>
    </button>
  );
}
