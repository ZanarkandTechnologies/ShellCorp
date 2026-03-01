import { describe, expect, it } from "vitest";
import { normalizeTelegramInbound } from "./telegram.js";

describe("normalizeTelegramInbound", () => {
  it("maps telegram payload to InboundEnvelope", () => {
    const envelope = normalizeTelegramInbound({
      chatId: "123",
      senderId: "42",
      senderName: "alice",
      content: "hi",
      isGroup: true,
      timestamp: 1700000000000,
    });

    expect(envelope).toMatchObject({
      channelId: "telegram",
      sourceId: "123",
      senderId: "42",
      senderName: "alice",
      content: "hi",
      isGroup: true,
      timestamp: 1700000000000,
    });
  });
});
