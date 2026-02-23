import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const messageArgs = {
  channelId: v.string(),
  sourceId: v.string(),
  senderId: v.string(),
  senderName: v.string(),
  content: v.string(),
  timestamp: v.number(),
  direction: v.union(v.literal("inbound"), v.literal("outbound")),
  mode: v.union(v.literal("conversational"), v.literal("observational")),
  threadId: v.optional(v.string()),
  callbackUrl: v.optional(v.string()),
  metadata: v.optional(v.any()),
};

export const ingest = mutationGeneric({
  args: messageArgs,
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    return ctx.db.insert("messages", args);
  },
});

export const listByChannel = queryGeneric({
  args: {
    channelId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 50, 200));
    return ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .take(limit);
  },
});

export const listRecent = queryGeneric({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 50, 200));
    return ctx.db.query("messages").withIndex("by_timestamp").order("desc").take(limit);
  },
});

export const search = queryGeneric({
  args: {
    term: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const term = args.term.toLowerCase().trim();
    const limit = Math.max(1, Math.min(args.limit ?? 50, 200));
    if (!term) return [];

    const recent = await ctx.db.query("messages").withIndex("by_timestamp").order("desc").take(400);
    return recent.filter((entry) => entry.content.toLowerCase().includes(term)).slice(0, limit);
  },
});
