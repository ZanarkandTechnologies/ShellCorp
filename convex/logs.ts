import { mutationGeneric } from "convex/server";
import { v } from "convex/values";

export const ingest = mutationGeneric({
  args: {
    ts: v.number(),
    kind: v.union(v.literal("agent"), v.literal("cron"), v.literal("channel")),
    payload: v.any(),
  },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    return ctx.db.insert("events", args);
  },
});
