import { describe, expect, it } from "vitest";
import { fahrenheitConfigSchema } from "../config/schema.js";
import type { InboundEnvelope } from "../types.js";
import { resolveRoute } from "./routing.js";

function envelope(overrides: Partial<InboundEnvelope> = {}): InboundEnvelope {
  return {
    channelId: "slack",
    sourceId: "C123",
    senderId: "U123",
    senderName: "Alice",
    content: "hello",
    timestamp: Date.now(),
    isGroup: true,
    ...overrides,
  };
}

describe("gateway routing", () => {
  it("matches group by scope for direct messages", () => {
    const config = fahrenheitConfigSchema.parse({
      gateway: {
        groups: {
          personal: {
            description: "DM inbox",
            allowFrom: ["*"],
            mode: "conversational",
            sources: [{ channel: "slack", scope: "dm" }],
          },
        },
      },
    });
    const resolved = resolveRoute(config, envelope({ isGroup: false, sourceId: "D123", senderId: "U1" }));
    expect(resolved?.groupId).toBe("personal");
    expect(resolved?.sessionKey).toBe("group:personal:slack:dm:U1");
    expect(resolved?.busyPolicy).toBe("queue");
  });

  it("matches group by explicit channelId for project channels", () => {
    const config = fahrenheitConfigSchema.parse({
      gateway: {
        groups: {
          projectAlpha: {
            description: "project alpha",
            allowFrom: ["*"],
            mode: "conversational",
            sources: [{ channel: "slack", channelIds: ["C_ALPHA_GEN"] }],
          },
        },
      },
    });
    const resolved = resolveRoute(config, envelope({ sourceId: "C_ALPHA_GEN" }));
    expect(resolved?.groupId).toBe("projectAlpha");
    expect(resolved?.sessionKey).toBe("group:projectAlpha:slack:group:C_ALPHA_GEN");
    expect(resolved?.busyPolicy).toBe("queue");
  });

  it("returns null when no configured group matches", () => {
    const config = fahrenheitConfigSchema.parse({
      gateway: {
        groups: {},
      },
    });
    const resolved = resolveRoute(config, envelope());
    expect(resolved).toBeNull();
  });

  it("captures route mode and allowFrom from group", () => {
    const config = fahrenheitConfigSchema.parse({
      gateway: {
        groups: {
          observer: {
            description: "observe only",
            allowFrom: ["U123"],
            mode: "observational",
            sources: [{ channel: "slack", scope: "group" }],
          },
        },
      },
    });
    const resolved = resolveRoute(config, envelope({ isGroup: true }));
    expect(resolved?.mode).toBe("observational");
    expect(resolved?.allowFrom).toEqual(["U123"]);
    expect(resolved?.busyPolicy).toBe("queue");
  });

  it("captures explicit busyPolicy when configured", () => {
    const config = fahrenheitConfigSchema.parse({
      gateway: {
        groups: {
          hotSession: {
            description: "interrupt on new message",
            allowFrom: ["*"],
            mode: "conversational",
            busyPolicy: "steer",
            sources: [{ channel: "slack", scope: "dm" }],
          },
        },
      },
    });
    const resolved = resolveRoute(config, envelope({ isGroup: false }));
    expect(resolved?.busyPolicy).toBe("steer");
  });

  it("prefers explicit channelId over earlier scope match", () => {
    const config = fahrenheitConfigSchema.parse({
      gateway: {
        groups: {
          personal: {
            description: "dm inbox",
            allowFrom: ["*"],
            mode: "conversational",
            sources: [{ channel: "discord", scope: "dm" }],
          },
          meiGroup: {
            description: "mei channels",
            allowFrom: ["*"],
            mode: "conversational",
            sources: [{ channel: "discord", channelIds: ["1475564331201462324"] }],
          },
        },
      },
    });
    const resolved = resolveRoute(
      config,
      envelope({
        channelId: "discord",
        sourceId: "1475564331201462324",
        isGroup: false,
      }),
    );
    expect(resolved?.groupId).toBe("meiGroup");
  });
});
