"use client";

/**
 * KANBAN COLUMN
 * =============
 * A single Team Kanban lane with CEO-workbench-aligned board styling.
 *
 * KEY CONCEPTS:
 * - Header shows lane dot, label, count badge, and compact description.
 * - Cards scroll independently per lane.
 * - Inline "+ Add task" input at the bottom: press Enter or blur to submit.
 * - Empty state uses a dashed border placeholder.
 *
 * USAGE:
 * - Render inside KanbanTab, one per board lane.
 */

import { useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KanbanTaskCard } from "./kanban-task-card";
import {
  type KanbanLaneKey,
  type PanelTask,
  STATUS_COLORS,
  STATUS_LABELS,
  type TaskStatus,
} from "./team-panel-types";

interface KanbanColumnProps {
  laneKey: KanbanLaneKey;
  tasks: PanelTask[];
  ownerLabelById: Map<string, string>;
  convexEnabled: boolean;
  isPending: boolean;
  onOpenTask: (task: PanelTask) => void;
  onAddTask: (title: string, status: TaskStatus) => void;
}

const LANE_BORDER: Record<KanbanLaneKey, string> = {
  todo: "border-border",
  in_progress: "border-primary/40",
  review: "border-amber-500/40",
  blocked: "border-destructive/30",
  done: "border-emerald-500/30",
};

const LANE_ACCENT: Record<KanbanLaneKey, string> = {
  todo: "text-muted-foreground",
  in_progress: "text-primary",
  review: "text-amber-500",
  blocked: "text-destructive",
  done: "text-emerald-500",
};

const LANE_LABELS: Record<KanbanLaneKey, string> = {
  todo: STATUS_LABELS.todo,
  in_progress: STATUS_LABELS.in_progress,
  review: "Review",
  blocked: STATUS_LABELS.blocked,
  done: STATUS_LABELS.done,
};

const LANE_DESCRIPTIONS: Record<KanbanLaneKey, string> = {
  todo: "Queued work waiting to start.",
  in_progress: "Active tasks the team is moving now.",
  review: "Needs human sign-off or requested changes.",
  blocked: "Needs intervention before work can continue.",
  done: "Completed tasks stay here for quick audit.",
};

export function KanbanColumn({
  laneKey,
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
  const canAddTask = laneKey !== "review";
  const addStatus: TaskStatus = laneKey;
  const dotClass = STATUS_COLORS[laneKey];

  function startAdding(): void {
    if (!canAddTask) return;
    setAddingTask(true);
    setNewTitle("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function commitAdd(): void {
    const trimmed = newTitle.trim();
    if (trimmed) {
      onAddTask(trimmed, addStatus);
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
    <section className={`flex min-h-0 flex-col border bg-card ${LANE_BORDER[laneKey]}`}>
      <div className="space-y-2 border-b border-border px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`} />
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
              {LANE_LABELS[laneKey]}
            </h3>
          </div>
          <span className="border border-border bg-background px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <p className={`text-xs leading-5 ${LANE_ACCENT[laneKey]}`}>{LANE_DESCRIPTIONS[laneKey]}</p>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-3 py-3">
        <div className="space-y-3 pb-3">
          {tasks.length === 0 && !addingTask ? (
            <div className="border border-dashed border-border bg-background p-4 text-center">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {laneKey === "todo"
                  ? "No tasks yet"
                  : laneKey === "in_progress"
                    ? "Nothing running"
                    : laneKey === "review"
                      ? "No tasks awaiting review"
                      : laneKey === "blocked"
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

          {addingTask ? (
            <div className="border border-border bg-background p-3">
              <input
                ref={inputRef}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
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

      {convexEnabled && canAddTask ? (
        <div className="border-t border-border px-3 py-3">
          <button
            type="button"
            className="flex w-full items-center gap-2 border border-transparent bg-background px-3 py-2 text-xs uppercase tracking-[0.14em] text-muted-foreground transition hover:border-border hover:bg-accent hover:text-foreground"
            onClick={startAdding}
            disabled={isPending}
          >
            <span className="text-sm leading-none">+</span>
            <span>Add task</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
