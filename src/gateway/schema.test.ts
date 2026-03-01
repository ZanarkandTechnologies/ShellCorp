import { describe, expect, it } from "vitest";
import { parseGatewayMessage } from "./schema.js";

describe("gatewayMessageSchema", () => {
  it("accepts a valid inbound payload", () => {
    const message = parseGatewayMessage({
      channelId: "telegram",
      sourceId: "chat-123",
      senderId: "user-1",
      senderName: "Alice",
      content: "hello",
      timestamp: Date.now(),
      direction: "inbound",
      mode: "conversational",
    });
    expect(message.channelId).toBe("telegram");
    expect(message.sourceId).toBe("chat-123");
  });

  it("rejects malformed payloads", () => {
    expect(() =>
      parseGatewayMessage({
        channelId: "telegram",
        sourceId: "",
        senderId: "user-1",
        senderName: "Alice",
        content: "hello",
        timestamp: Date.now(),
        direction: "upstream",
        mode: "conversational",
      }),
    ).toThrowError();
  });
});
