import { describe, expect, it } from "vitest";
import { buildAgentTimelineRows } from "./agent-memory-timeline";

describe("agent memory timeline helpers", () => {
  it("maps convex events into timeline rows", () => {
    const rows = buildAgentTimelineRows({
      convexAgentEvents: [
        {
          _id: "evt-1",
          eventType: "status_report",
          label: "Planning",
          occurredAt: 100,
          sessionKey: "agent:main:session",
        },
      ],
      entries: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("status_report");
    expect(rows[0]?.source).toContain("session:");
  });

  it("falls back to memory entries when convex events are unavailable", () => {
    const rows = buildAgentTimelineRows({
      convexAgentEvents: undefined,
      entries: [
        {
          id: "mem-1",
          agentId: "main",
          source: { sourcePath: "MEMORY.md", lineNumber: 12 },
          rawText: "raw",
          text: "Made decision",
          ts: 50,
          memId: "MEM-2000",
          tags: [],
          type: "decision",
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("decision");
    expect(rows[0]?.detail).toBe("MEM: MEM-2000");
  });
});
