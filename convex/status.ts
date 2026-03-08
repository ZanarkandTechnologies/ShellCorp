import { query } from "./_generated/server";
import { v } from "convex/values";
import { normalizeTeamId } from "./_utils";

export const getAgentStatus = query({
  args: {
    agentId: v.string(),
    teamId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const teamId = args.teamId?.trim().toLowerCase();
    if (teamId) {
      return ctx.db
        .query("agentStatus")
        .withIndex("by_team_agent", (q) => q.eq("teamId", teamId).eq("agentId", args.agentId))
        .first();
    }
    return ctx.db
      .query("agentStatus")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();
  },
});

export const getMultipleAgentStatuses = query({
  args: {
    agentIds: v.array(v.string()),
    teamId: v.optional(v.string()),
    recentWindowMs: v.optional(v.number()),
    recentLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const teamId = args.teamId?.trim().toLowerCase();
    const recentWindowMs = Math.min(Math.max(args.recentWindowMs ?? 5000, 1000), 60000);
    const recentLimit = Math.min(Math.max(args.recentLimit ?? 5, 1), 20);
    const rows = await Promise.all(
      args.agentIds.map((agentId) => {
        if (teamId) {
          return ctx.db
            .query("agentStatus")
            .withIndex("by_team_agent", (q) => q.eq("teamId", teamId).eq("agentId", agentId))
            .first();
        }
        return ctx.db
          .query("agentStatus")
          .withIndex("by_agent", (q) => q.eq("agentId", agentId))
          .first();
      }),
    );

    const recentEvents = await Promise.all(
      args.agentIds.map(async (agentId) => {
        const raw = teamId
          ? await ctx.db
              .query("agentEvents")
              .withIndex("by_team_agent_occurred_at", (q) => q.eq("teamId", teamId).eq("agentId", agentId))
              .order("desc")
              .take(recentLimit)
          : await ctx.db
              .query("agentEvents")
              .withIndex("by_agent", (q) => q.eq("agentId", agentId))
              .order("desc")
              .take(recentLimit);
        return raw
          .filter((row) => row.occurredAt >= now - recentWindowMs)
          .map((row) => ({
            eventType: row.eventType,
            label: row.label,
            detail: row.detail,
            occurredAt: row.occurredAt,
          }));
      }),
    );

    return args.agentIds.reduce<
      Record<
        string,
        {
          agentId: string;
          state: string;
          statusText: string;
          bubbles: Array<{ id: string; label: string; weight: number }>;
          sessionKey?: string;
          updatedAt?: number;
          recentEvents?: Array<{ eventType: string; label: string; detail?: string; occurredAt: number }>;
        }
      >
    >((acc, agentId, index) => {
      const row = rows[index];
      const eventsForAgent = recentEvents[index] ?? [];
      const latestEvent = eventsForAgent[0];
      const fallbackState =
        latestEvent?.eventType === "heartbeat_error"
          ? "error"
          : latestEvent
            ? "running"
            : "idle";
      const fallbackStatusText = latestEvent?.label ?? "Idle";
      const fallbackBubbles = eventsForAgent
        .map((event, eventIndex) => ({
          id: `recent:${agentId}:${eventIndex}:${event.label}`,
          label: event.label,
          weight: Math.max(30, 60 - eventIndex),
        }))
        .slice(0, 3);

      acc[agentId] = {
        agentId,
        state: typeof row?.state === "string" ? row.state : fallbackState,
        statusText: typeof row?.statusText === "string" && row.statusText.trim() ? row.statusText : fallbackStatusText,
        bubbles: Array.isArray(row?.bubbles) && row.bubbles.length > 0 ? row.bubbles : fallbackBubbles,
        sessionKey: typeof row?.sessionKey === "string" ? row.sessionKey : undefined,
        updatedAt: typeof row?.updatedAt === "number" ? row.updatedAt : latestEvent?.occurredAt,
        recentEvents: eventsForAgent,
      };
      return acc;
    }, {});
  },
});

export const getAgentEvents = query({
  args: {
    agentId: v.string(),
    teamId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    const teamId = args.teamId?.trim().toLowerCase();
    if (teamId) {
      return ctx.db
        .query("agentEvents")
        .withIndex("by_team_agent_occurred_at", (q) => q.eq("teamId", teamId).eq("agentId", args.agentId))
        .order("desc")
        .take(limit);
    }
    const rows = await ctx.db
      .query("agentEvents")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(limit);
    return rows;
  },
});

export const getTeamActivityFeed = query({
  args: {
    teamId: v.string(),
    limit: v.optional(v.number()),
    beforeTs: v.optional(v.number()),
    agentId: v.optional(v.string()),
    sourceType: v.optional(v.string()),
    allowedAgentIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const teamId = normalizeTeamId(args.teamId);
    if (!teamId) return { events: [], nextBeforeTs: undefined, hasMore: false };
    const limit = Math.min(Math.max(args.limit ?? 120, 1), 300);
    const beforeTs = typeof args.beforeTs === "number" && Number.isFinite(args.beforeTs) && args.beforeTs > 0 ? args.beforeTs : undefined;
    const agentFilter = args.agentId?.trim();
    const sourceFilter = args.sourceType?.trim();
    const allowedAgentIds = new Set(
      (args.allowedAgentIds ?? [])
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    );
    const enforceAllowedAgents = allowedAgentIds.size > 0;
    const overfetch = Math.min(Math.max(limit * 4, 80), 1200);

    const [agentEventRows, boardRows] = await Promise.all([
      ctx.db
        .query("agentEvents")
        .withIndex("by_team_occurred_at", (q) => (beforeTs ? q.eq("teamId", teamId).lt("occurredAt", beforeTs) : q.eq("teamId", teamId)))
        .order("desc")
        .take(overfetch),
      ctx.db
        .query("teamBoardEvents")
        .withIndex("by_team_occurred_at", (q) => (beforeTs ? q.eq("teamId", teamId).lt("occurredAt", beforeTs) : q.eq("teamId", teamId)))
        .order("desc")
        .take(overfetch),
    ]);

    const merged: ActivityFeedEvent[] = [
      ...agentEventRows.map((row) => ({
        id: String(row._id),
        sourceType: "agent_event" as const,
        occurredAt: row.occurredAt,
        beatId: row.beatId,
        sessionKey: row.sessionKey,
        agentId: row.agentId,
        eventType: row.eventType,
        activityType: row.activityType,
        label: row.label,
        detail: row.detail,
        taskId: row.taskId,
        projectId: row.projectId,
      })),
      ...boardRows.map((row) => ({
        id: String(row._id),
        sourceType: "board_event" as const,
        occurredAt: row.occurredAt,
        beatId: row.beatId,
        agentId: row.actorAgentId,
        eventType: row.eventType,
        label: row.label,
        detail: row.detail,
        taskId: row.taskId,
        projectId: row.projectId,
      })),
    ]
      .filter((event) =>
        enforceAllowedAgents ? (event.agentId ? allowedAgentIds.has(event.agentId) : false) : true,
      )
      .filter((event) => (agentFilter ? event.agentId === agentFilter : true))
      .filter((event) => {
        if (!sourceFilter || sourceFilter === "all") return true;
        if (sourceFilter === "activity_event") {
          return event.sourceType === "agent_event" && typeof event.activityType === "string" && event.activityType.trim().length > 0;
        }
        return event.sourceType === sourceFilter;
      })
      .sort((left, right) => right.occurredAt - left.occurredAt);

    const events = merged.slice(0, limit);
    const hasMore = merged.length > limit;
    const nextBeforeTs = hasMore ? merged[limit]?.occurredAt : undefined;
    return { events, nextBeforeTs, hasMore };
  },
});

export const getRecentAgentEvents = query({
  args: {
    teamId: v.optional(v.string()),
    limit: v.optional(v.number()),
    windowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const teamId = args.teamId?.trim().toLowerCase();
    const limit = Math.min(Math.max(args.limit ?? 120, 1), 500);
    const windowMs = Math.min(Math.max(args.windowMs ?? 120_000, 1000), 3_600_000);
    const rows = teamId
      ? await ctx.db
          .query("agentEvents")
          .withIndex("by_team_occurred_at", (q) => q.eq("teamId", teamId))
          .order("desc")
          .take(limit)
      : await ctx.db.query("agentEvents").withIndex("by_occurred_at").order("desc").take(limit);

    return rows.filter((row) => row.occurredAt >= now - windowMs);
  },
});

type ActivityFeedEvent = {
  id: string;
  sourceType: "agent_event" | "board_event";
  occurredAt: number;
  beatId?: string;
  sessionKey?: string;
  agentId?: string;
  eventType?: string;
  activityType?: string;
  label: string;
  detail?: string;
  taskId?: string;
  projectId?: string;
};

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0))];
}

export const getAgentActivityFeed = query({
  args: {
    agentId: v.string(),
    teamId: v.optional(v.string()),
    limit: v.optional(v.number()),
    beforeTs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const agentId = args.agentId.trim();
    if (!agentId) return { events: [], beats: [], ungrouped: [], nextBeforeTs: undefined, hasMore: false };
    const teamId = normalizeTeamId(args.teamId);
    const limit = Math.min(Math.max(args.limit ?? 120, 1), 300);
    const beforeTs = typeof args.beforeTs === "number" && Number.isFinite(args.beforeTs) && args.beforeTs > 0 ? args.beforeTs : undefined;
    const overfetch = Math.min(Math.max(limit * 4, 80), 1200);

    const agentEventRows = teamId
      ? await ctx.db
          .query("agentEvents")
          .withIndex("by_team_agent_occurred_at", (q) =>
            beforeTs ? q.eq("teamId", teamId).eq("agentId", agentId).lt("occurredAt", beforeTs) : q.eq("teamId", teamId).eq("agentId", agentId),
          )
          .order("desc")
          .take(overfetch)
      : (
          await ctx.db.query("agentEvents").withIndex("by_agent", (q) => q.eq("agentId", agentId)).order("desc").take(overfetch)
        ).filter((row) => (beforeTs ? row.occurredAt < beforeTs : true));

    const boardRows = teamId
      ? (
          await ctx.db
            .query("teamBoardEvents")
            .withIndex("by_team_occurred_at", (q) => (beforeTs ? q.eq("teamId", teamId).lt("occurredAt", beforeTs) : q.eq("teamId", teamId)))
            .order("desc")
            .take(overfetch * 2)
        ).filter((row) => row.actorAgentId === agentId)
      : [];

    const merged: ActivityFeedEvent[] = [
      ...agentEventRows.map((row) => ({
        id: String(row._id),
        sourceType: "agent_event" as const,
        occurredAt: row.occurredAt,
        beatId: row.beatId,
        sessionKey: row.sessionKey,
        agentId: row.agentId,
        eventType: row.eventType,
        activityType: row.activityType,
        label: row.label,
        detail: row.detail,
        taskId: row.taskId,
        projectId: row.projectId,
      })),
      ...boardRows.map((row) => ({
        id: String(row._id),
        sourceType: "board_event" as const,
        occurredAt: row.occurredAt,
        beatId: row.beatId,
        agentId: row.actorAgentId,
        eventType: row.eventType,
        label: row.label,
        detail: row.detail,
        taskId: row.taskId,
        projectId: row.projectId,
      })),
    ].sort((left, right) => right.occurredAt - left.occurredAt);

    const limited = merged.slice(0, limit);
    const hasMore = merged.length > limit;
    const nextBeforeTs = hasMore ? merged[limit]?.occurredAt : undefined;

    const grouped = new Map<
      string,
      {
        beatId: string;
        startedAt: number;
        endedAt: number;
        taskIds: string[];
        sessionKeys: string[];
        outcome: "done" | "blocked" | "error" | "in_progress";
        summary: string;
        events: ActivityFeedEvent[];
      }
    >();
    const ungrouped: ActivityFeedEvent[] = [];

    for (const event of limited) {
      const beatId = event.beatId?.trim();
      if (!beatId) {
        ungrouped.push(event);
        continue;
      }
      const current = grouped.get(beatId);
      if (!current) {
        grouped.set(beatId, {
          beatId,
          startedAt: event.occurredAt,
          endedAt: event.occurredAt,
          taskIds: event.taskId ? [event.taskId] : [],
          sessionKeys: event.sessionKey ? [event.sessionKey] : [],
          outcome:
            event.eventType === "heartbeat_error"
              ? "error"
              : event.eventType === "task_blocked"
                ? "blocked"
              : event.eventType === "task_done"
                ? "done"
                : "in_progress",
          summary: event.label,
          events: [event],
        });
        continue;
      }
      current.startedAt = Math.min(current.startedAt, event.occurredAt);
      current.endedAt = Math.max(current.endedAt, event.occurredAt);
      current.taskIds = uniqueStrings([...current.taskIds, event.taskId]);
      current.sessionKeys = uniqueStrings([...current.sessionKeys, event.sessionKey]);
      current.events.push(event);
      if (current.outcome !== "error" && (event.eventType === "heartbeat_error" || event.eventType === "task_blocked")) {
        current.outcome = event.eventType === "task_blocked" ? "blocked" : "error";
      } else if (current.outcome === "in_progress" && event.eventType === "task_done") {
        current.outcome = "done";
      }
    }

    const beats = [...grouped.values()]
      .map((beat) => ({
        ...beat,
        events: beat.events.sort((left, right) => left.occurredAt - right.occurredAt),
      }))
      .sort((left, right) => right.endedAt - left.endedAt);

    return {
      events: limited,
      beats,
      ungrouped,
      nextBeforeTs,
      hasMore,
    };
  },
});

export const getAgentSummaries = query({
  args: {
    teamId: v.string(),
    windowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const teamId = normalizeTeamId(args.teamId);
    if (!teamId) return [];
    const windowMs = Math.min(Math.max(args.windowMs ?? 6 * 60 * 60 * 1000, 60_000), 14 * 24 * 60 * 60 * 1000);
    const cutoff = Date.now() - windowMs;

    const [statusRows, recentEvents, recentBoardRows] = await Promise.all([
      ctx.db.query("agentStatus").withIndex("by_team_agent", (q) => q.eq("teamId", teamId)).collect(),
      ctx.db.query("agentEvents").withIndex("by_team_occurred_at", (q) => q.eq("teamId", teamId)).order("desc").take(1500),
      ctx.db.query("teamBoardEvents").withIndex("by_team_occurred_at", (q) => q.eq("teamId", teamId)).order("desc").take(2000),
    ]);

    const filteredEvents = recentEvents.filter((row) => row.occurredAt >= cutoff);
    const filteredBoardRows = recentBoardRows.filter((row) => row.occurredAt >= cutoff);
    const agentIds = uniqueStrings([
      ...statusRows.map((row) => row.agentId),
      ...filteredEvents.map((row) => row.agentId),
      ...filteredBoardRows.map((row) => row.actorAgentId),
    ]);

    return agentIds
      .map((agentId) => {
        const status = statusRows.find((row) => row.agentId === agentId);
        const eventsForAgent = filteredEvents.filter((row) => row.agentId === agentId);
        const boardForAgent = filteredBoardRows.filter((row) => row.actorAgentId === agentId);
        const beatCount = new Set(
          eventsForAgent
            .filter((row) => row.eventType === "heartbeat_start")
            .map((row) => row.beatId)
            .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
        ).size;
        const doneCount = boardForAgent.filter((row) => row.eventType === "task_done").length;
        const blockedCount = boardForAgent.filter((row) => row.eventType === "task_blocked").length;
        const errorCount = eventsForAgent.filter((row) => row.eventType === "heartbeat_error").length;
        const latestOccurredAt = Math.max(
          status?.updatedAt ?? 0,
          ...eventsForAgent.map((row) => row.occurredAt),
          ...boardForAgent.map((row) => row.occurredAt),
        );
        const latest =
          [...eventsForAgent, ...boardForAgent]
            .sort((left, right) => right.occurredAt - left.occurredAt)
            .map((row) => ("label" in row ? row.label : ""))
            .find((label) => typeof label === "string" && label.trim().length > 0) ??
          status?.statusText ??
          "No recent updates";
        return {
          agentId,
          beatCount,
          doneCount,
          blockedCount,
          errorCount,
          latest,
          latestOccurredAt,
          state: status?.state ?? "idle",
          statusText: status?.statusText ?? latest,
        };
      })
      .sort((left, right) => right.latestOccurredAt - left.latestOccurredAt);
  },
});
