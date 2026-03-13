import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { normalizeTeamId } from "./_utils";
import {
  type AgentEventType,
  type AgentState,
  coerceAgentEventType,
  coerceAgentState,
  reduceStatus,
} from "./status_contract";

function initialSnapshot(): {
  state: AgentState;
  statusText: string;
  bubbles: Array<{ id: string; label: string; weight: number }>;
  currentBeatId?: string;
  currentSkillId?: string;
} {
  return {
    state: "idle",
    statusText: "Idle",
    bubbles: [],
  };
}

async function applyEvent(params: {
  ctx: MutationCtx;
  teamId?: string;
  projectId?: string;
  agentId: string;
  eventType: AgentEventType;
  activityType?: string;
  actorType?: string;
  label: string;
  detail?: string;
  state?: AgentState;
  skillId?: string;
  source?: string;
  stepKey?: string;
  sessionKey?: string;
  beatId?: string;
  taskId?: string;
  occurredAt?: number;
}): Promise<{ duplicate: boolean }> {
  // MEM-0132 decision: agent status/event logs carry teamId as first-class context.
  const now = Date.now();
  const eventTs = params.occurredAt ?? now;

  if (params.stepKey && params.stepKey.trim().length > 0) {
    const existingStep = await params.ctx.db
      .query("agentEvents")
      .withIndex("by_agent_step_key", (q) =>
        q.eq("agentId", params.agentId).eq("stepKey", params.stepKey),
      )
      .first();
    if (existingStep) {
      return { duplicate: true };
    }
  }

  const teamId = normalizeTeamId(params.teamId);
  const projectId = params.projectId?.trim();
  const activityType = params.activityType?.trim();
  const actorType = params.actorType?.trim();
  const taskId = params.taskId?.trim();

  if (projectId && params.stepKey && params.stepKey.trim().length > 0) {
    const existingProjectStep = await params.ctx.db
      .query("agentEvents")
      .withIndex("by_project_step_key", (q) =>
        q.eq("projectId", projectId).eq("stepKey", params.stepKey),
      )
      .first();
    if (existingProjectStep) {
      return { duplicate: true };
    }
  }

  await params.ctx.db.insert("agentEvents", {
    teamId,
    projectId,
    agentId: params.agentId,
    eventType: params.eventType,
    activityType,
    actorType,
    label: params.label,
    detail: params.detail,
    state: params.state,
    skillId: params.skillId,
    source: params.source,
    stepKey: params.stepKey,
    sessionKey: params.sessionKey,
    beatId: params.beatId,
    taskId,
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
        currentSkillId: existing.currentSkillId,
      }
    : initialSnapshot();

  const next = reduceStatus(base, {
    eventType: params.eventType,
    activityType,
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
      currentSkillId: next.currentSkillId,
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
    currentSkillId: next.currentSkillId,
    sessionKey: params.sessionKey,
    updatedAt: eventTs,
    lastEventAt: now,
  });
  return { duplicate: false };
}

export const ingestEvent = internalMutation({
  args: {
    teamId: v.optional(v.string()),
    projectId: v.optional(v.string()),
    agentId: v.string(),
    eventType: v.string(),
    activityType: v.optional(v.string()),
    actorType: v.optional(v.string()),
    label: v.string(),
    detail: v.optional(v.string()),
    state: v.optional(v.string()),
    skillId: v.optional(v.string()),
    source: v.optional(v.string()),
    stepKey: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    beatId: v.optional(v.string()),
    taskId: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const eventType = coerceAgentEventType(args.eventType);
    if (!eventType) return;
    await applyEvent({
      ctx,
      teamId: args.teamId,
      projectId: args.projectId,
      agentId: args.agentId,
      eventType,
      activityType: args.activityType,
      actorType: args.actorType,
      label: args.label,
      detail: args.detail,
      state: coerceAgentState(args.state),
      skillId: args.skillId,
      source: args.source,
      stepKey: args.stepKey,
      sessionKey: args.sessionKey,
      beatId: args.beatId,
      taskId: args.taskId,
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
