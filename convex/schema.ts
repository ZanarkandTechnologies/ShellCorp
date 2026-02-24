import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
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
  })
    .index("by_channel", ["channelId", "timestamp"])
    .index("by_source", ["channelId", "sourceId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),
  events: defineTable({
    ts: v.number(),
    kind: v.union(v.literal("agent"), v.literal("cron"), v.literal("channel")),
    payload: v.any(),
  }).index("by_ts", ["ts"]),
  observations: defineTable({
    event: v.any(),
    historyLine: v.string(),
    memoryLine: v.optional(v.string()),
    promotion: v.object({
      promoted: v.boolean(),
      reason: v.string(),
      promotionClass: v.optional(v.union(v.literal("informational"), v.literal("operational"), v.literal("warning"))),
    }),
    projectId: v.string(),
    groupId: v.string(),
    sessionKey: v.string(),
    source: v.string(),
    createdAtMs: v.number(),
  })
    .index("by_project_ts", ["projectId", "createdAtMs"])
    .index("by_group_ts", ["groupId", "createdAtMs"])
    .index("by_session_ts", ["sessionKey", "createdAtMs"])
    .index("by_source_ts", ["source", "createdAtMs"])
    .index("by_ts", ["createdAtMs"]),
});
