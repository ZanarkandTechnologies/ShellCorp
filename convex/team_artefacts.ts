/**
 * TEAM ARTEFACT INDEX DOMAIN
 * ==========================
 * Purpose
 * - Persist a bounded Convex metadata index for project-scoped workspace artefacts.
 *
 * KEY CONCEPTS:
 * - Workspace files remain canonical in OpenClaw-managed workspaces.
 * - Convex stores a refreshable cache for fast Artefacts tab rendering.
 * - Refresh is explicit and bounded; this is not a full workspace mirror.
 *
 * USAGE:
 * - `listProjectArtefactIndex` powers cached Artefacts tab rendering.
 * - `syncProjectArtefactIndex` upserts one project refresh result from the UI.
 *
 * MEMORY REFERENCES:
 * - MEM-0136
 * - MEM-0214
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { normalizeTeamId, nowMs, trimOrUndefined } from "./_utils";

const artefactInput = v.object({
  agentId: v.string(),
  workspace: v.string(),
  path: v.string(),
  name: v.string(),
  kind: v.string(),
  sizeBytes: v.optional(v.number()),
  updatedAtMs: v.optional(v.number()),
  isPreviewable: v.boolean(),
  taskId: v.optional(v.string()),
});

export const listProjectArtefactIndex = query({
  args: {
    projectId: v.string(),
    limit: v.optional(v.number()),
    includeMissing: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const projectId = args.projectId.trim();
    if (!projectId) throw new Error("missing_project_id");
    const limit = Math.min(Math.max(args.limit ?? 400, 1), 1200);
    const includeMissing = args.includeMissing === true;
    const rows = await ctx.db
      .query("projectArtefactIndex")
      .withIndex("by_project_indexed_at", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(limit);

    const filtered = includeMissing ? rows : rows.filter((row) => row.status === "present");
    const latestIndexedAtMs = filtered.reduce(
      (max, row) => Math.max(max, row.indexedAtMs, row.lastSeenAtMs),
      0,
    );
    const truncated = filtered.some((row) => row.truncated === true);

    return {
      projectId,
      indexedAtMs: latestIndexedAtMs || undefined,
      truncated,
      files: filtered
        .sort((left, right) => {
          const tsDelta =
            (right.updatedAtMs ?? right.indexedAtMs) - (left.updatedAtMs ?? left.indexedAtMs);
          if (tsDelta !== 0) return tsDelta;
          return left.path.localeCompare(right.path);
        })
        .map((row) => ({
          _id: row._id,
          teamId: row.teamId,
          projectId: row.projectId,
          agentId: row.agentId,
          workspace: row.workspace,
          path: row.path,
          name: row.name,
          kind: row.kind,
          sizeBytes: row.sizeBytes,
          updatedAtMs: row.updatedAtMs,
          indexedAtMs: row.indexedAtMs,
          lastSeenAtMs: row.lastSeenAtMs,
          status: row.status,
          isPreviewable: row.isPreviewable,
          taskId: row.taskId,
          truncated: row.truncated === true,
        })),
    };
  },
});

export const syncProjectArtefactIndex = mutation({
  args: {
    teamId: v.optional(v.string()),
    projectId: v.string(),
    indexedAtMs: v.optional(v.number()),
    truncated: v.optional(v.boolean()),
    files: v.array(artefactInput),
  },
  handler: async (ctx, args) => {
    const projectId = args.projectId.trim();
    if (!projectId) throw new Error("missing_project_id");
    const indexedAtMs = nowMs(args.indexedAtMs);
    const teamId = normalizeTeamId(args.teamId);

    const existingRows = await ctx.db
      .query("projectArtefactIndex")
      .withIndex("by_project_indexed_at", (q) => q.eq("projectId", projectId))
      .collect();

    const existingByKey = new Map<string, (typeof existingRows)[number]>(
      existingRows.map((row) => [`${row.agentId}::${row.path}`, row] as const),
    );
    const incomingKeys = new Set<string>();

    for (const file of args.files) {
      const agentId = file.agentId.trim();
      const path = file.path.trim();
      const name = file.name.trim();
      const workspace = file.workspace.trim();
      const kind = file.kind.trim() || "unknown";
      if (!agentId || !path || !name) continue;
      const key = `${agentId}::${path}`;
      incomingKeys.add(key);
      const payload = {
        teamId,
        projectId,
        agentId,
        workspace,
        path,
        name,
        kind,
        sizeBytes: typeof file.sizeBytes === "number" ? file.sizeBytes : undefined,
        updatedAtMs: typeof file.updatedAtMs === "number" ? file.updatedAtMs : undefined,
        indexedAtMs,
        lastSeenAtMs: indexedAtMs,
        status: "present" as const,
        isPreviewable: file.isPreviewable,
        taskId: trimOrUndefined(file.taskId),
        truncated: args.truncated === true ? true : undefined,
      };
      const existing = existingByKey.get(key);
      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("projectArtefactIndex", payload);
      }
    }

    for (const row of existingRows) {
      const key = `${row.agentId}::${row.path}`;
      if (incomingKeys.has(key)) continue;
      await ctx.db.patch(row._id, {
        teamId,
        indexedAtMs,
        status: "missing" as const,
        truncated: args.truncated === true ? true : undefined,
      });
    }

    return {
      ok: true,
      projectId,
      indexedAtMs,
      fileCount: incomingKeys.size,
      missingCount: Math.max(existingRows.length - incomingKeys.size, 0),
      truncated: args.truncated === true,
    };
  },
});
