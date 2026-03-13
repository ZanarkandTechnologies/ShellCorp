"use client";

/**
 * KANBAN TAB
 * ==========
 * Orchestrates the Notion-style Kanban board: four status columns + task detail modal.
 *
 * KEY CONCEPTS:
 * - Board state is read from Convex (canonical) or sidecar (fallback).
 * - All mutations go through boardCommand via the onBoardCommand callback.
 * - Task detail modal is driven by selectedTask local state.
 * - Quick-add at the bottom of each column uses task_add command.
 *
 * USAGE:
 * - Rendered inside TeamPanel as the "kanban" TabsContent.
 */

import { useMemo, useState } from "react";
import { statusColumns, type PanelTask, type TaskStatus } from "./team-panel-types";
import { KanbanColumn } from "./kanban-column";
import { TaskDetailModal } from "./task-detail-modal";

type EmployeeModel = {
  _id: string;
  name: string;
};

interface KanbanTabProps {
  projectTasks: PanelTask[];
  focusAgentId?: string | null;
  teamEmployees: EmployeeModel[];
  ownerLabelById: Map<string, string>;
  convexEnabled: boolean;
  showReadOnlyNotice?: boolean;
  boardActionState: { pending: boolean; error?: string; ok?: string };
  onBoardCommand: (
    command: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ) => Promise<void>;
}

const COLUMN_ORDER: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];

export function KanbanTab({
  projectTasks,
  focusAgentId,
  teamEmployees,
  ownerLabelById,
  convexEnabled,
  showReadOnlyNotice = true,
  boardActionState,
  onBoardCommand,
}: KanbanTabProps): JSX.Element {
  const [selectedTask, setSelectedTask] = useState<PanelTask | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const visibleTasks = useMemo(
    () =>
      focusAgentId ? projectTasks.filter((t) => t.ownerAgentId === focusAgentId) : projectTasks,
    [focusAgentId, projectTasks],
  );

  const columns = statusColumns(visibleTasks);

  const employeeOptions = useMemo(
    () =>
      teamEmployees
        .map((employee) => {
          const rawId = String(employee._id ?? "").trim();
          const agentId = rawId.startsWith("employee-") ? rawId.slice("employee-".length) : rawId;
          return { id: agentId, name: employee.name };
        })
        .filter((employee) => employee.id.length > 0),
    [teamEmployees],
  );

  function openTask(task: PanelTask): void {
    setSelectedTask(task);
    setIsDetailOpen(true);
  }

  function closeDetail(): void {
    setIsDetailOpen(false);
    setSelectedTask(null);
  }

  async function handleAddTask(title: string, status: TaskStatus): Promise<void> {
    await onBoardCommand("task_add", { title, status, priority: "medium" }, "Task added.");
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {focusAgentId ? (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Showing tasks owned by <span className="font-mono">{focusAgentId}</span> in this panel
          scope.
        </div>
      ) : null}

      {!convexEnabled && showReadOnlyNotice ? (
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Read-only view — connect Convex to enable task creation and edits.
        </div>
      ) : null}

      {boardActionState.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {boardActionState.error}
        </div>
      ) : null}
      {boardActionState.ok ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600">
          {boardActionState.ok}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMN_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={columns[status]}
            ownerLabelById={ownerLabelById}
            convexEnabled={convexEnabled}
            isPending={boardActionState.pending}
            onOpenTask={openTask}
            onAddTask={handleAddTask}
          />
        ))}
      </div>

      <TaskDetailModal
        task={selectedTask}
        isOpen={isDetailOpen}
        onClose={closeDetail}
        employees={employeeOptions}
        ownerLabelById={ownerLabelById}
        isPending={boardActionState.pending}
        onCommand={onBoardCommand}
      />
    </div>
  );
}
