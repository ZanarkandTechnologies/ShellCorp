import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  const value = Number.isFinite(limit) ? Number(limit) : fallback;
  return Math.max(1, Math.min(value, max));
}

function includeEntry(
  entry: { event: any; promotion: { promoted: boolean } },
  filters: {
    projectId?: string;
    source?: string;
    projectTag?: string;
    trustClass?: "trusted" | "untrusted" | "system";
    signalType?: "blocker" | "risk" | "upsell" | "improvement";
    status?: "accepted" | "pending_review";
  },
): boolean {
  const event = entry.event as Record<string, unknown>;
  const signals = Array.isArray(event.signals) ? event.signals as Array<Record<string, unknown>> : [];
  const projectTags = Array.isArray(event.projectTags) ? event.projectTags as string[] : [];
  if (filters.projectId && event.projectId !== filters.projectId) return false;
  if (filters.source && event.source !== filters.source) return false;
  if (filters.projectTag && !projectTags.includes(filters.projectTag)) return false;
  if (filters.trustClass && event.trustClass !== filters.trustClass) return false;
  if (filters.signalType && !signals.some((signal) => signal.type === filters.signalType)) return false;
  if (filters.status && event.status !== filters.status) return false;
  return true;
}

export const appendObservation = mutationGeneric({
  args: {
    event: v.any(),
    autoPromoteTrust: v.array(v.union(v.literal("trusted"), v.literal("untrusted"), v.literal("system"))),
    minConfidenceAutoPromote: v.optional(v.number()),
  },
  returns: v.object({
    event: v.any(),
    promotion: v.object({
      promoted: v.boolean(),
      reason: v.string(),
      promotionClass: v.optional(v.union(v.literal("informational"), v.literal("operational"), v.literal("warning"))),
    }),
  }),
  handler: async (ctx, args) => {
    const event = args.event as Record<string, any>;
    const minConfidence = Math.max(0, Math.min(args.minConfidenceAutoPromote ?? 0.7, 1));
    const confidence = typeof event.confidence === "number" ? event.confidence : 0;
    if (confidence < minConfidence) {
      event.status = "pending_review";
    } else if (typeof event.status !== "string") {
      event.status = "accepted";
    }

    const signals = Array.isArray(event.signals) ? event.signals as Array<Record<string, unknown>> : [];
    const hasWarningSignal = signals.some((signal) => signal.type === "blocker" || signal.type === "risk");
    const hasOperationalSignal = signals.some((signal) => signal.type === "upsell" || signal.type === "improvement");
    const promotionClass = hasWarningSignal ? "warning" : hasOperationalSignal ? "operational" : "informational";
    const trustClass = typeof event.trustClass === "string" ? event.trustClass : "trusted";
    const canTrustPromote = args.autoPromoteTrust.includes(trustClass as "trusted" | "untrusted" | "system");
    const promoted = event.status === "accepted" && canTrustPromote;
    const promotion = promoted
      ? { promoted: true, reason: "auto_promoted", promotionClass }
      : {
          promoted: false,
          reason: event.status === "pending_review" ? "low_confidence_pending_review" : `trust_requires_approval:${trustClass}`,
        };
    const signalSummary = signals
      .map((signal) => String(signal.type ?? ""))
      .filter(Boolean)
      .join(",");
    const projectScope = Array.isArray(event.projectTags) && event.projectTags.length > 0 ? event.projectTags.join(",") : "unscoped";
    const roleScope = Array.isArray(event.roleTags) && event.roleTags.length > 0 ? event.roleTags.join(",") : "unscoped";
    const historyLine = `- OBSERVATION ${JSON.stringify(event)}`;
    const memoryLine = promoted
      ? `- ${String(event.occurredAt ?? new Date().toISOString())} | ${promotionClass} | source=${String(event.source ?? "")} | projectId=${String(event.projectId ?? "")} | trust=${trustClass} | project=${projectScope} | role=${roleScope} | signals=${signalSummary || "none"} | summary=${String(event.summary ?? "")} | ref=${String(event.sourceRef ?? "")}`
      : undefined;
    await ctx.db.insert("observations", {
      event,
      historyLine,
      memoryLine,
      promotion,
      projectId: String(event.projectId ?? "unknown"),
      groupId: String(event.groupId ?? "unknown"),
      sessionKey: String(event.sessionKey ?? "unknown"),
      source: String(event.source ?? "unknown"),
      createdAtMs: Date.now(),
    });
    return {
      event,
      promotion,
    };
  },
});

export const listObservations = queryGeneric({
  args: {
    limit: v.optional(v.number()),
    projectId: v.optional(v.string()),
    groupId: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    source: v.optional(v.string()),
    projectTag: v.optional(v.string()),
    trustClass: v.optional(v.union(v.literal("trusted"), v.literal("untrusted"), v.literal("system"))),
    signalType: v.optional(v.union(v.literal("blocker"), v.literal("risk"), v.literal("upsell"), v.literal("improvement"))),
    status: v.optional(v.union(v.literal("accepted"), v.literal("pending_review"))),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 200, 5000);
    const prefetch = Math.max(limit, 1000);
    const rows = args.sessionKey
      ? await ctx.db.query("observations").withIndex("by_session_ts", (q) => q.eq("sessionKey", args.sessionKey!)).order("desc").take(prefetch)
      : args.projectId
        ? await ctx.db.query("observations").withIndex("by_project_ts", (q) => q.eq("projectId", args.projectId!)).order("desc").take(prefetch)
      : args.groupId
        ? await ctx.db.query("observations").withIndex("by_group_ts", (q) => q.eq("groupId", args.groupId!)).order("desc").take(prefetch)
        : args.source
          ? await ctx.db.query("observations").withIndex("by_source_ts", (q) => q.eq("source", args.source!)).order("desc").take(prefetch)
          : await ctx.db.query("observations").withIndex("by_ts").order("desc").take(prefetch);
    return rows
      .filter((entry) => includeEntry(entry, args))
      .slice(0, limit)
      .map((entry) => entry.event);
  },
});

export const listHistoryLines = queryGeneric({
  args: {
    limit: v.optional(v.number()),
    projectId: v.optional(v.string()),
    groupId: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    source: v.optional(v.string()),
    projectTag: v.optional(v.string()),
    trustClass: v.optional(v.union(v.literal("trusted"), v.literal("untrusted"), v.literal("system"))),
    signalType: v.optional(v.union(v.literal("blocker"), v.literal("risk"), v.literal("upsell"), v.literal("improvement"))),
    status: v.optional(v.union(v.literal("accepted"), v.literal("pending_review"))),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 200, 5000);
    const prefetch = Math.max(limit, 1000);
    const rows = args.sessionKey
      ? await ctx.db.query("observations").withIndex("by_session_ts", (q) => q.eq("sessionKey", args.sessionKey!)).order("desc").take(prefetch)
      : args.projectId
        ? await ctx.db.query("observations").withIndex("by_project_ts", (q) => q.eq("projectId", args.projectId!)).order("desc").take(prefetch)
      : args.groupId
        ? await ctx.db.query("observations").withIndex("by_group_ts", (q) => q.eq("groupId", args.groupId!)).order("desc").take(prefetch)
        : await ctx.db.query("observations").withIndex("by_ts").order("desc").take(prefetch);
    return rows
      .filter((entry) => includeEntry(entry, args))
      .slice(0, limit)
      .map((entry) => entry.historyLine);
  },
});

export const listMemoryLines = queryGeneric({
  args: {
    limit: v.optional(v.number()),
    projectId: v.optional(v.string()),
    groupId: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    source: v.optional(v.string()),
    projectTag: v.optional(v.string()),
    trustClass: v.optional(v.union(v.literal("trusted"), v.literal("untrusted"), v.literal("system"))),
    signalType: v.optional(v.union(v.literal("blocker"), v.literal("risk"), v.literal("upsell"), v.literal("improvement"))),
    status: v.optional(v.union(v.literal("accepted"), v.literal("pending_review"))),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 200, 5000);
    const prefetch = Math.max(limit, 1000);
    const rows = args.sessionKey
      ? await ctx.db.query("observations").withIndex("by_session_ts", (q) => q.eq("sessionKey", args.sessionKey!)).order("desc").take(prefetch)
      : args.projectId
        ? await ctx.db.query("observations").withIndex("by_project_ts", (q) => q.eq("projectId", args.projectId!)).order("desc").take(prefetch)
      : args.groupId
        ? await ctx.db.query("observations").withIndex("by_group_ts", (q) => q.eq("groupId", args.groupId!)).order("desc").take(prefetch)
        : await ctx.db.query("observations").withIndex("by_ts").order("desc").take(prefetch);
    return rows
      .filter((entry) => includeEntry(entry, args))
      .map((entry) => entry.memoryLine)
      .filter((line): line is string => typeof line === "string")
      .slice(0, limit);
  },
});
