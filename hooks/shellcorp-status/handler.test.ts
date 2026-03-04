import { describe, expect, it } from "vitest";
import { classifyEvent } from "./handler";

describe("shellcorp-status hook transform", () => {
  it("classifies heartbeat start from inbound prompt", () => {
    const events = classifyEvent({
      type: "message",
      action: "received",
      sessionKey: "agent:main:main",
      timestamp: new Date("2026-03-04T02:15:00.000Z"),
      context: {
        content:
          "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. If nothing needs attention, reply HEARTBEAT_OK.",
      },
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("heartbeat_start");
    expect(events[0]?.agentId).toBe("main");
  });

  it("classifies heartbeat ok from outbound message", () => {
    const events = classifyEvent({
      type: "message",
      action: "sent",
      sessionKey: "agent:main:main",
      context: { content: "HEARTBEAT_OK" },
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("heartbeat_ok");
  });

  it("extracts tool calls from message content", () => {
    const events = classifyEvent({
      type: "message",
      action: "sent",
      sessionKey: "agent:main:main",
      context: { content: "I used ReadFile then Shell to complete the step." },
    });

    const eventTypes = events.map((event) => event.eventType);
    const labels = events.map((event) => event.label);
    expect(eventTypes).toEqual(["tool_call", "tool_call"]);
    expect(labels).toEqual(["ReadFile", "Shell"]);
  });

  it("ignores non-agent sessions", () => {
    const events = classifyEvent({
      type: "message",
      action: "received",
      sessionKey: "telegram:main",
      context: { content: "HEARTBEAT_OK" },
    });

    expect(events).toEqual([]);
  });
});
