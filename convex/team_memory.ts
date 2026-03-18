/**
 * TEAM MEMORY DOMAIN
 * ==================
 * Purpose
 * - Persist shared team/project memory as an append-only realtime log.
 *
 * KEY CONCEPTS:
 * - Team memory is distinct from private OpenClaw agent memory and from task-local notes.
 * - Entries are immutable log rows with a structured envelope and markdown body payload.
 *
 * USAGE:
 * - `listProjectTeamMemory` powers the Team Panel Memory tab.
 * - `appendTeamMemoryEntry` lets operators and agents add shared memory rows.
 *
 * MEMORY REFERENCES:
 * - MEM-0196
 * - MEM-0209
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { normalizeTeamId, nowMs, trimOrUndefined } from "./_utils";

const memoryKind = v.union(
  v.literal("note"),
  v.literal("decision"),
  v.literal("handoff"),
  v.literal("result"),
  v.literal("risk"),
  v.literal("summary"),
);

const authorType = v.union(v.literal("agent"), v.literal("operator"), v.literal("system"));

export const listProjectTeamMemory = query({
  args: {
    projectId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const projectId = args.projectId.trim();
    if (!projectId) throw new Error("missing_project_id");
    const limit = Math.min(Math.max(args.limit ?? 120, 1), 400);
    const rows = await ctx.db
      .query("teamMemoryEntries")
      .withIndex("by_project_created_at", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(limit);

    return rows.map((row) => ({
      _id: row._id,
      teamId: row.teamId,
      projectId: row.projectId,
      taskId: row.taskId,
      agentId: row.agentId,
      authorType: row.authorType,
      kind: row.kind,
      body: row.body,
      createdAt: row.createdAt,
    }));
  },
});

export const appendTeamMemoryEntry = mutation({
  args: {
    teamId: v.optional(v.string()),
    projectId: v.string(),
    taskId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    authorType,
    kind: memoryKind,
    body: v.string(),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const projectId = args.projectId.trim();
    if (!projectId) throw new Error("missing_project_id");
    const body = args.body.trim();
    if (!body) throw new Error("missing_memory_body");

    const entryId = await ctx.db.insert("teamMemoryEntries", {
      teamId: normalizeTeamId(args.teamId),
      projectId,
      taskId: trimOrUndefined(args.taskId),
      agentId: trimOrUndefined(args.agentId),
      authorType: args.authorType,
      kind: args.kind,
      body,
      createdAt: nowMs(args.createdAt),
    });

    return { ok: true, entryId };
  },
});
