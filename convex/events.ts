import { internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  coerceAgentEventType,
  coerceAgentState,
  reduceStatus,
  type AgentEventType,
  type AgentState,
} from "./status_contract";

function initialSnapshot(): {
  state: AgentState;
  statusText: string;
  bubbles: Array<{ id: string; label: string; weight: number }>;
  currentBeatId?: string;
} {
  return {
    state: "idle",
    statusText: "Idle",
    bubbles: [],
  };
}

function normalizeTeamId(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : undefined;
}

async function applyEvent(params: {
  ctx: MutationCtx;
  teamId?: string;
  agentId: string;
  eventType: AgentEventType;
  label: string;
  detail?: string;
  state?: AgentState;
  skillId?: string;
  source?: string;
  stepKey?: string;
  sessionKey?: string;
  beatId?: string;
  occurredAt?: number;
}): Promise<{ duplicate: boolean }> {
  // MEM-0132 decision: agent status/event logs carry teamId as first-class context.
  const now = Date.now();
  const eventTs = params.occurredAt ?? now;

  if (params.stepKey && params.stepKey.trim().length > 0) {
    const existingStep = await params.ctx.db
      .query("agentEvents")
      .withIndex("by_agent_step_key", (q) => q.eq("agentId", params.agentId).eq("stepKey", params.stepKey))
      .first();
    if (existingStep) {
      return { duplicate: true };
    }
  }

  const teamId = normalizeTeamId(params.teamId);

  await params.ctx.db.insert("agentEvents", {
    teamId,
    agentId: params.agentId,
    eventType: params.eventType,
    label: params.label,
    detail: params.detail,
    state: params.state,
    skillId: params.skillId,
    source: params.source,
    stepKey: params.stepKey,
    sessionKey: params.sessionKey,
    beatId: params.beatId,
    occurredAt: eventTs,
  });

  const existing = await params.ctx.db
    .query("agentStatus")
    .withIndex("by_agent", (q) => q.eq("agentId", params.agentId))
    .first();

  const base = existing
    ? {
        state: (coerceAgentState(existing.state) ?? "idle") as AgentState,
        statusText: existing.statusText,
        bubbles: [...existing.bubbles],
        currentBeatId: existing.currentBeatId,
      }
    : initialSnapshot();

  const next = reduceStatus(base, {
    eventType: params.eventType,
    label: params.label,
    detail: params.detail,
    beatId: params.beatId,
    state: params.state,
    skillId: params.skillId,
  });

  if (existing) {
    await params.ctx.db.patch(existing._id, {
      teamId: teamId ?? existing.teamId,
      state: next.state,
      statusText: next.statusText,
      bubbles: next.bubbles,
      currentBeatId: next.currentBeatId,
      sessionKey: params.sessionKey ?? existing.sessionKey,
      updatedAt: eventTs,
      lastEventAt: now,
    });
    return { duplicate: false };
  }

  await params.ctx.db.insert("agentStatus", {
    teamId,
    agentId: params.agentId,
    state: next.state,
    statusText: next.statusText,
    bubbles: next.bubbles,
    currentBeatId: next.currentBeatId,
    sessionKey: params.sessionKey,
    updatedAt: eventTs,
    lastEventAt: now,
  });
  return { duplicate: false };
}

export const ingestEvent = internalMutation({
  args: {
    teamId: v.optional(v.string()),
    agentId: v.string(),
    eventType: v.string(),
    label: v.string(),
    detail: v.optional(v.string()),
    state: v.optional(v.string()),
    skillId: v.optional(v.string()),
    source: v.optional(v.string()),
    stepKey: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    beatId: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const eventType = coerceAgentEventType(args.eventType);
    if (!eventType) return;
    await applyEvent({
      ctx,
      teamId: args.teamId,
      agentId: args.agentId,
      eventType,
      label: args.label,
      detail: args.detail,
      state: coerceAgentState(args.state),
      skillId: args.skillId,
      source: args.source,
      stepKey: args.stepKey,
      sessionKey: args.sessionKey,
      beatId: args.beatId,
      occurredAt: args.occurredAt,
    });
  },
});

export const reportStatus = internalMutation({
  args: {
    teamId: v.optional(v.string()),
    agentId: v.string(),
    state: v.string(),
    statusText: v.string(),
    stepKey: v.string(),
    skillId: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    beatId: v.optional(v.string()),
    source: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const state = coerceAgentState(args.state);
    if (!state) {
      throw new Error(`invalid_state:${args.state}`);
    }
    const stepKey = args.stepKey.trim();
    if (!stepKey) {
      throw new Error("missing_step_key");
    }
    const label =
      state === "planning" || state === "executing" || state === "blocked" || state === "done"
        ? state
        : "status";
    const applied = await applyEvent({
      ctx,
      teamId: args.teamId,
      agentId: args.agentId,
      eventType: "status_report",
      label,
      detail: args.statusText,
      state,
      skillId: args.skillId,
      source: args.source ?? "agent.self_report",
      stepKey,
      sessionKey: args.sessionKey,
      beatId: args.beatId,
      occurredAt: args.occurredAt,
    });
    return { ok: true, duplicate: applied.duplicate };
  },
});

export const clearStaleEvents = internalMutation({
  args: {
    olderThanMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Deprecated cleanup helper retained for manual operations only.
    // Scheduled pruning was removed so timeline history stays auditable.
    const cutoff = Date.now() - (args.olderThanMs ?? 24 * 60 * 60 * 1000);
    const maxRows = Math.min(Math.max(args.limit ?? 200, 1), 1000);
    const staleRows = await ctx.db
      .query("agentEvents")
      .withIndex("by_occurred_at", (q) => q.lt("occurredAt", cutoff))
      .take(maxRows);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});
