import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "./schema.js";

describe("messages store", () => {
  it("ingests and lists by channel", async () => {
    const t = convexTest(schema);

    await t.mutation(anyApi.messages.ingest, {
      channelId: "telegram",
      sourceId: "chat-1",
      senderId: "u1",
      senderName: "Alice",
      content: "hello world",
      timestamp: Date.now(),
      direction: "inbound",
      mode: "conversational",
    });

    await t.mutation(anyApi.messages.ingest, {
      channelId: "discord",
      sourceId: "thread-1",
      senderId: "u2",
      senderName: "Bob",
      content: "from discord",
      timestamp: Date.now(),
      direction: "inbound",
      mode: "observational",
    });

    const telegramMessages = await t.query(anyApi.messages.listByChannel, {
      channelId: "telegram",
      limit: 10,
    });
    expect(telegramMessages).toHaveLength(1);
    expect(telegramMessages[0]).toMatchObject({ content: "hello world" });
  });

  it("supports recent and keyword search", async () => {
    const t = convexTest(schema);

    await t.mutation(anyApi.messages.ingest, {
      channelId: "telegram",
      sourceId: "chat-1",
      senderId: "u1",
      senderName: "Alice",
      content: "gateway event alpha",
      timestamp: Date.now(),
      direction: "inbound",
      mode: "conversational",
    });
    await t.mutation(anyApi.messages.ingest, {
      channelId: "telegram",
      sourceId: "chat-1",
      senderId: "u1",
      senderName: "Alice",
      content: "beta payload",
      timestamp: Date.now() + 1,
      direction: "inbound",
      mode: "conversational",
    });

    const recent = await t.query(anyApi.messages.listRecent, { limit: 2 });
    expect(recent).toHaveLength(2);

    const filtered = await t.query(anyApi.messages.search, {
      term: "gateway",
      limit: 10,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({ content: "gateway event alpha" });
  });
});
