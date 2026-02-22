import { describe, expect, it } from "vitest";
import { isSenderAllowed } from "./auth.js";
import type { FahrenheitConfig } from "../config/schema.js";
import { fahrenheitConfigSchema } from "../config/schema.js";
import type { InboundEnvelope } from "../types.js";

function baseConfig(overrides: Partial<FahrenheitConfig> = {}): FahrenheitConfig {
  const base = fahrenheitConfigSchema.parse({});
  return { ...base, ...overrides };
}

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
    expect(isSenderAllowed(baseConfig(), inbound)).toBe(true);
  });

  it("supports wildcard allowlist", () => {
    const config = baseConfig({
      channels: {
        telegram: { enabled: true, allowFrom: ["*"] },
        discord: { enabled: false, allowFrom: [] },
        slack: { enabled: false, allowFrom: [] },
        whatsapp: { enabled: false, allowFrom: [], printQr: true },
      },
    });
    expect(isSenderAllowed(config, inbound)).toBe(true);
  });

  it("blocks sender not in allowlist", () => {
    const config = baseConfig({
      channels: {
        telegram: { enabled: true, allowFrom: ["u2"] },
        discord: { enabled: false, allowFrom: [] },
        slack: { enabled: false, allowFrom: [] },
        whatsapp: { enabled: false, allowFrom: [], printQr: true },
      },
    });
    expect(isSenderAllowed(config, inbound)).toBe(false);
  });
});
