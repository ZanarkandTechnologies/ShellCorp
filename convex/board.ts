import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  coerceActivityEventType,
  coerceBoardActorType,
  coerceBoardTaskPriority,
  coerceBoardTaskStatus,
} from "./board_contract";

type TaskRow = {
  projectId: string;
  taskId: string;
  title: string;
  status: string;
  ownerAgentId?: string;
  priority: string;
  provider: string;
  canonicalProvider: string;
  providerUrl?: string;
  syncState: string;
  syncError?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  updatedBy?: string;
  dueAt?: number;
};

type BoardCommand =
  | "task_add"
  | "task_update"
  | "task_delete"
  | "task_move"
  | "task_assign"
  | "task_block"
  | "task_done"
  | "task_reopen"
  | "task_reprioritize"
  | "activity_log";

type BoardPermission = "team.read" | "team.board.write" | "team.activity.write";

const ROLE_PERMISSIONS: Record<string, BoardPermission[]> = {
  operator: ["team.read", "team.board.write", "team.activity.write"],
  pm: ["team.read", "team.board.write", "team.activity.write"],
  biz_pm: ["team.read", "team.board.write", "team.activity.write"],
  builder: ["team.read", "team.board.write", "team.activity.write"],
  growth_marketer: ["team.read", "team.board.write", "team.activity.write"],
  biz_executor: ["team.read", "team.board.write", "team.activity.write"],
  readonly: ["team.read"],
};

function nowMs(value?: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Date.now();
}

function trimOrUndefined(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTeamId(value?: string): string | undefined {
  const trimmed = trimOrUndefined(value);
  return trimmed ? trimmed.toLowerCase() : undefined;
}

function ensureTaskId(input?: string): string {
  const cleaned = trimOrUndefined(input);
  if (cleaned) return cleaned;
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function priorityRank(priority: string): number {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function isCommand(value: string): value is BoardCommand {
  return (
    value === "task_add" ||
    value === "task_update" ||
    value === "task_delete" ||
    value === "task_move" ||
    value === "task_assign" ||
    value === "task_block" ||
    value === "task_done" ||
    value === "task_reopen" ||
    value === "task_reprioritize" ||
    value === "activity_log"
  );
}

function requiredPermissionForCommand(command: BoardCommand): BoardPermission {
  return command === "activity_log" ? "team.activity.write" : "team.board.write";
}

function permissionSetFromInput(actorRole: string, raw?: string): Set<BoardPermission> {
  if (raw?.trim()) {
    const entries = raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (entries.includes("*")) return new Set(["team.read", "team.board.write", "team.activity.write"]);
    return new Set(entries as BoardPermission[]);
  }
  return new Set(ROLE_PERMISSIONS[actorRole] ?? ROLE_PERMISSIONS.operator);
}

export const boardCommand = mutation({
  args: {
    teamId: v.optional(v.string()),
    projectId: v.string(),
    command: v.string(),
    taskId: v.optional(v.string()),
    title: v.optional(v.string()),
    status: v.optional(v.string()),
    ownerAgentId: v.optional(v.string()),
    priority: v.optional(v.string()),
    detail: v.optional(v.string()),
    notes: v.optional(v.string()),
    label: v.optional(v.string()),
    activityType: v.optional(v.string()),
    actorType: v.optional(v.string()),
    actorAgentId: v.optional(v.string()),
    actorRole: v.optional(v.string()),
    allowedPermissions: v.optional(v.string()),
    skillId: v.optional(v.string()),
    stepKey: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    occurredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // MEM-0132 decision: persist first-class teamId for timeline isolation/audits.
    const teamId = normalizeTeamId(args.teamId);
    const command = args.command.trim();
    if (!isCommand(command)) throw new Error(`invalid_command:${command}`);
    const projectId = args.projectId.trim();
    if (!projectId) throw new Error("missing_project_id");

    const stepKey = trimOrUndefined(args.stepKey);
    const occurredAt = nowMs(args.occurredAt);
    const actorType = coerceBoardActorType(args.actorType) ?? (command === "activity_log" ? "agent" : "operator");
    const actorRole = trimOrUndefined(args.actorRole)?.toLowerCase() ?? "operator";
    const actorAgentId = trimOrUndefined(args.actorAgentId);
    const requiredPermission = requiredPermissionForCommand(command);
    const permissions = permissionSetFromInput(actorRole, trimOrUndefined(args.allowedPermissions));
    if (!permissions.has(requiredPermission)) throw new Error(`permission_denied:${requiredPermission}:role=${actorRole}`);

    if (command === "activity_log") {
      if (!actorAgentId) throw new Error("missing_actor_agent_id");
      const activityType = coerceActivityEventType(args.activityType);
      if (!activityType) throw new Error(`invalid_activity_type:${args.activityType ?? ""}`);
      if (stepKey) {
        const existing = await ctx.db
          .query("teamActivityEvents")
          .withIndex("by_project_step_key", (q) => q.eq("projectId", projectId).eq("stepKey", stepKey))
          .first();
        if (existing) return { ok: true, duplicate: true, taskId: trimOrUndefined(args.taskId) };
      }
      await ctx.db.insert("teamActivityEvents", {
        teamId,
        projectId,
        agentId: actorAgentId,
        activityType,
        label: trimOrUndefined(args.label) ?? activityType,
        detail: trimOrUndefined(args.detail),
        actorType,
        taskId: trimOrUndefined(args.taskId),
        skillId: trimOrUndefined(args.skillId),
        state: coerceBoardTaskStatus(args.status),
        occurredAt,
        stepKey,
      });
      return { ok: true, duplicate: false, taskId: trimOrUndefined(args.taskId) };
    }

    const taskId = trimOrUndefined(args.taskId);
    const ownerAgentId = trimOrUndefined(args.ownerAgentId);
    const detail = trimOrUndefined(args.detail);
    const notes = trimOrUndefined(args.notes);

    if (stepKey) {
      const existing = await ctx.db
        .query("teamBoardEvents")
        .withIndex("by_project_step_key", (q) => q.eq("projectId", projectId).eq("stepKey", stepKey))
        .first();
      if (existing) return { ok: true, duplicate: true, taskId: existing.taskId };
    }

    if (command === "task_add") {
      const title = trimOrUndefined(args.title);
      if (!title) throw new Error("missing_title");
      const nextTaskId = ensureTaskId(taskId);
      const existing = await ctx.db
        .query("teamBoardTasks")
        .withIndex("by_project_task_id", (q) => q.eq("projectId", projectId).eq("taskId", nextTaskId))
        .first();
      if (existing) throw new Error(`task_exists:${nextTaskId}`);
      const status = coerceBoardTaskStatus(args.status) ?? "todo";
      const priority = coerceBoardTaskPriority(args.priority) ?? "medium";
      await ctx.db.insert("teamBoardTasks", {
        projectId,
        taskId: nextTaskId,
        title,
        status,
        ownerAgentId,
        priority,
        provider: "internal",
        canonicalProvider: "internal",
        syncState: "healthy",
        notes,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        createdBy: actorAgentId,
        updatedBy: actorAgentId,
        dueAt: args.dueAt,
      });
      await ctx.db.insert("teamBoardEvents", {
        teamId,
        projectId,
        taskId: nextTaskId,
        eventType: "task_created",
        actorType,
        actorAgentId,
        label: trimOrUndefined(args.label) ?? "Task created",
        detail,
        toStatus: status,
        occurredAt,
        stepKey,
      });
      return { ok: true, duplicate: false, taskId: nextTaskId };
    }

    if (!taskId) throw new Error("missing_task_id");
    const existingTask = await ctx.db
      .query("teamBoardTasks")
      .withIndex("by_project_task_id", (q) => q.eq("projectId", projectId).eq("taskId", taskId))
      .first();
    if (!existingTask) throw new Error(`task_not_found:${taskId}`);

    if (command === "task_delete") {
      await ctx.db.delete(existingTask._id);
      await ctx.db.insert("teamBoardEvents", {
        teamId,
        projectId,
        taskId,
        eventType: "task_deleted",
        actorType,
        actorAgentId,
        label: trimOrUndefined(args.label) ?? "Task deleted",
        detail,
        fromStatus: existingTask.status,
        occurredAt,
        stepKey,
      });
      return { ok: true, duplicate: false, taskId };
    }

    const patch: Partial<TaskRow> = {
      updatedAt: occurredAt,
      updatedBy: actorAgentId,
    };
    let eventType:
      | "task_moved"
      | "task_assigned"
      | "task_blocked"
      | "task_done"
      | "task_reopened"
      | "task_reprioritized"
      | "task_updated" = "task_moved";
    let eventLabel = trimOrUndefined(args.label) ?? "Task updated";
    let toStatus: string | undefined;

    if (command === "task_update") {
      const title = trimOrUndefined(args.title);
      if (title !== undefined) patch.title = title;
      if (detail !== undefined) patch.notes = detail;
      if (typeof args.dueAt === "number") patch.dueAt = args.dueAt;
      eventType = "task_updated";
      eventLabel = trimOrUndefined(args.label) ?? "Task details updated";
    } else if (command === "task_move") {
      const status = coerceBoardTaskStatus(args.status);
      if (!status) throw new Error(`invalid_status:${args.status ?? ""}`);
      patch.status = status;
      toStatus = status;
      eventType = "task_moved";
      eventLabel = trimOrUndefined(args.label) ?? `Moved to ${status}`;
    } else if (command === "task_assign") {
      patch.ownerAgentId = ownerAgentId;
      eventType = "task_assigned";
      eventLabel = trimOrUndefined(args.label) ?? `Assigned ${ownerAgentId ?? "unassigned"}`;
    } else if (command === "task_block") {
      patch.status = "blocked";
      toStatus = "blocked";
      eventType = "task_blocked";
      eventLabel = trimOrUndefined(args.label) ?? "Marked blocked";
    } else if (command === "task_done") {
      patch.status = "done";
      toStatus = "done";
      eventType = "task_done";
      eventLabel = trimOrUndefined(args.label) ?? "Marked done";
    } else if (command === "task_reopen") {
      patch.status = "todo";
      toStatus = "todo";
      eventType = "task_reopened";
      eventLabel = trimOrUndefined(args.label) ?? "Reopened";
    } else if (command === "task_reprioritize") {
      const priority = coerceBoardTaskPriority(args.priority);
      if (!priority) throw new Error(`invalid_priority:${args.priority ?? ""}`);
      patch.priority = priority;
      eventType = "task_reprioritized";
      eventLabel = trimOrUndefined(args.label) ?? `Priority ${priority}`;
    }

    if (notes !== undefined) patch.notes = notes;
    await ctx.db.patch(existingTask._id, patch);
    await ctx.db.insert("teamBoardEvents", {
      teamId,
      projectId,
      taskId,
      eventType,
      actorType,
      actorAgentId,
      label: eventLabel,
      detail,
      fromStatus: existingTask.status,
      toStatus,
      occurredAt,
      stepKey,
    });

    return { ok: true, duplicate: false, taskId };
  },
});

export const getProjectBoard = query({
  args: {
    projectId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("teamBoardTasks")
      .withIndex("by_project_updated_at", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(500);
    const tasks = rows.map((row) => ({
      taskId: row.taskId,
      projectId: row.projectId,
      title: row.title,
      status: row.status,
      ownerAgentId: row.ownerAgentId,
      priority: row.priority,
      provider: row.provider,
      canonicalProvider: row.canonicalProvider,
      providerUrl: row.providerUrl,
      syncState: row.syncState,
      syncError: row.syncError,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      dueAt: row.dueAt,
    }));
    return {
      projectId: args.projectId,
      tasks,
    };
  },
});

export const getProjectBoardEvents = query({
  args: {
    projectId: v.string(),
    teamId: v.optional(v.string()),
    limit: v.optional(v.number()),
    taskId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 40, 1), 200);
    const teamId = normalizeTeamId(args.teamId);
    if (args.taskId?.trim()) {
      return ctx.db
        .query("teamBoardEvents")
        .withIndex("by_project_task_occurred_at", (q) => q.eq("projectId", args.projectId).eq("taskId", args.taskId!.trim()))
        .order("desc")
        .take(limit);
    }
    if (teamId) {
      const rows = await ctx.db
        .query("teamBoardEvents")
        .withIndex("by_team_occurred_at", (q) => q.eq("teamId", teamId))
        .order("desc")
        .take(limit);
      if (rows.length > 0) return rows;
    }
    return ctx.db
      .query("teamBoardEvents")
      .withIndex("by_project_occurred_at", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(limit);
  },
});

export const getProjectActivity = query({
  args: {
    projectId: v.string(),
    teamId: v.optional(v.string()),
    limit: v.optional(v.number()),
    agentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const teamId = normalizeTeamId(args.teamId);
    if (args.agentId?.trim()) {
      if (teamId) {
        const rowsByTeam = await ctx.db
          .query("teamActivityEvents")
          .withIndex("by_team_agent_occurred_at", (q) => q.eq("teamId", teamId).eq("agentId", args.agentId!.trim()))
          .order("desc")
          .take(limit);
        if (rowsByTeam.length > 0) return rowsByTeam;
      }
      return ctx.db
        .query("teamActivityEvents")
        .withIndex("by_project_agent_occurred_at", (q) => q.eq("projectId", args.projectId).eq("agentId", args.agentId!.trim()))
        .order("desc")
        .take(limit);
    }
    if (teamId) {
      const rowsByTeam = await ctx.db
        .query("teamActivityEvents")
        .withIndex("by_team_occurred_at", (q) => q.eq("teamId", teamId))
        .order("desc")
        .take(limit);
      if (rowsByTeam.length > 0) return rowsByTeam;
    }
    return ctx.db
      .query("teamActivityEvents")
      .withIndex("by_project_occurred_at", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(limit);
  },
});

export const getTeamTimeline = query({
  args: {
    teamId: v.string(),
    projectId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 60, 1), 200);
    const teamId = normalizeTeamId(args.teamId);
    if (!teamId) return [];
    const projectId = trimOrUndefined(args.projectId);
    const agentId = trimOrUndefined(args.agentId);

    const [boardEvents, activityEvents] = await Promise.all([
      ctx.db
        .query("teamBoardEvents")
        .withIndex("by_team_occurred_at", (q) => q.eq("teamId", teamId))
        .order("desc")
        .take(limit),
      agentId
        ? ctx.db
            .query("teamActivityEvents")
            .withIndex("by_team_agent_occurred_at", (q) => q.eq("teamId", teamId).eq("agentId", agentId))
            .order("desc")
            .take(limit)
        : ctx.db
            .query("teamActivityEvents")
            .withIndex("by_team_occurred_at", (q) => q.eq("teamId", teamId))
            .order("desc")
            .take(limit),
    ]);

    const merged = [
      ...boardEvents.map((row) => ({ ...row, sourceType: "board_event" as const })),
      ...activityEvents.map((row) => ({ ...row, sourceType: "activity_event" as const })),
    ]
      .filter((row) => (projectId ? row.projectId === projectId : true))
      .sort((a, b) => b.occurredAt - a.occurredAt);

    return merged.slice(0, limit);
  },
});

export const getNextTaskCandidates = query({
  args: {
    projectId: v.string(),
    agentId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 5, 1), 50);
    const rows = await ctx.db
      .query("teamBoardTasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const agentId = trimOrUndefined(args.agentId);

    const filtered = rows.filter((row) => row.status !== "done");
    const sorted = filtered.sort((a, b) => {
      const aOwnerScore = agentId && a.ownerAgentId === agentId ? 2 : !a.ownerAgentId ? 1 : 0;
      const bOwnerScore = agentId && b.ownerAgentId === agentId ? 2 : !b.ownerAgentId ? 1 : 0;
      if (aOwnerScore !== bOwnerScore) return bOwnerScore - aOwnerScore;
      const rankDelta = priorityRank(b.priority) - priorityRank(a.priority);
      if (rankDelta !== 0) return rankDelta;
      return b.updatedAt - a.updatedAt;
    });

    return sorted.slice(0, limit).map((row) => ({
      taskId: row.taskId,
      title: row.title,
      status: row.status,
      ownerAgentId: row.ownerAgentId,
      priority: row.priority,
      updatedAt: row.updatedAt,
    }));
  },
});

