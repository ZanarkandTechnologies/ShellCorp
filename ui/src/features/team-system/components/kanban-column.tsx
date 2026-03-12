"use client";

/**
 * KANBAN COLUMN
 * =============
 * A single status column in the Kanban board with Notion-style design.
 *
 * KEY CONCEPTS:
 * - Header shows colored status dot, label, and task count badge.
 * - Cards scroll independently per column.
 * - Inline "+ Add task" input at the bottom: press Enter or blur to submit.
 * - Empty state uses a dashed border placeholder.
 *
 * USAGE:
 * - Render inside KanbanTab, one per status column.
 */

import { useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KanbanTaskCard } from "./kanban-task-card";
import { STATUS_COLORS, STATUS_LABELS, type PanelTask, type TaskStatus } from "./team-panel-types";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: PanelTask[];
  ownerLabelById: Map<string, string>;
  convexEnabled: boolean;
  isPending: boolean;
  onOpenTask: (task: PanelTask) => void;
  onAddTask: (title: string, status: TaskStatus) => void;
}

const COLUMN_BG: Record<TaskStatus, string> = {
  todo: "bg-muted/5",
  in_progress: "bg-blue-500/5",
  blocked: "bg-red-500/5",
  done: "bg-emerald-500/5",
};

export function KanbanColumn({
  status,
  tasks,
  ownerLabelById,
  convexEnabled,
  isPending,
  onOpenTask,
  onAddTask,
}: KanbanColumnProps): JSX.Element {
  const [addingTask, setAddingTask] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startAdding(): void {
    setAddingTask(true);
    setNewTitle("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function commitAdd(): void {
    const trimmed = newTitle.trim();
    if (trimmed) {
      onAddTask(trimmed, status);
    }
    setAddingTask(false);
    setNewTitle("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") commitAdd();
    if (e.key === "Escape") {
      setAddingTask(false);
      setNewTitle("");
    }
  }

  return (
    <div className={`flex flex-col rounded-xl border ${COLUMN_BG[status]} min-h-0`}>
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-3">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status]}`} />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {STATUS_LABELS[status]}
        </span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      {/* Cards list */}
      <ScrollArea className="min-h-0 flex-1 px-2">
        <div className="space-y-2 pb-2">
          {tasks.length === 0 && !addingTask ? (
            <div className="rounded-lg border border-dashed border-border/50 px-3 py-4 text-center">
              <p className="text-xs text-muted-foreground/60">
                {status === "todo"
                  ? "No tasks yet"
                  : status === "in_progress"
                    ? "Nothing running"
                    : status === "blocked"
                      ? "All clear"
                      : "Completed tasks appear here"}
              </p>
            </div>
          ) : null}

          {tasks.map((task) => (
            <KanbanTaskCard
              key={task.id}
              task={task}
              ownerLabel={
                task.ownerAgentId
                  ? (ownerLabelById.get(task.ownerAgentId) ?? task.ownerAgentId)
                  : "unassigned"
              }
              onOpen={onOpenTask}
            />
          ))}

          {/* Inline add input */}
          {addingTask ? (
            <div className="rounded-lg border bg-card p-2 shadow-sm">
              <input
                ref={inputRef}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                placeholder="Task title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={commitAdd}
                disabled={isPending}
              />
            </div>
          ) : null}
        </div>
      </ScrollArea>

      {/* Add task footer */}
      {convexEnabled ? (
        <div className="border-t px-2 py-2">
          <button
            type="button"
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground/70 transition-colors hover:bg-muted/40 hover:text-muted-foreground"
            onClick={startAdding}
            disabled={isPending}
          >
            <span className="text-base leading-none">+</span>
            <span>Add task</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
