import { query } from "./_generated/server";
import { v } from "convex/values";

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
      const rows = await ctx.db
        .query("agentEvents")
        .withIndex("by_team_agent_occurred_at", (q) => q.eq("teamId", teamId).eq("agentId", args.agentId))
        .order("desc")
        .take(limit);
      if (rows.length > 0) return rows;
    }
    const rows = await ctx.db
      .query("agentEvents")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(limit);
    return rows;
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
