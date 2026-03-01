import { describe, expect, it } from "vitest";
import { isSenderAllowed } from "./auth.js";
import type { InboundEnvelope } from "../types.js";

const inbound: InboundEnvelope = {
  channelId: "telegram",
  sourceId: "chat-1",
  senderId: "u1",
  senderName: "user",
  content: "hello",
  timestamp: Date.now(),
  isGroup: false,
};

describe("isSenderAllowed", () => {
  it("allows any sender when allowlist is empty", () => {
    expect(isSenderAllowed([], inbound)).toBe(true);
  });

  it("supports wildcard allowlist", () => {
    expect(isSenderAllowed(["*"], inbound)).toBe(true);
  });

  it("blocks sender not in allowlist", () => {
    expect(isSenderAllowed(["u2"], inbound)).toBe(false);
  });
});
