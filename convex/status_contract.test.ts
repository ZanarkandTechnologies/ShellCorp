import { describe, expect, it } from "vitest";
import { coerceAgentEventType, coerceAgentState, reduceStatus } from "./status_contract";

describe("status-contract", () => {
  it("accepts self-report states and falls back on unknown", () => {
    expect(coerceAgentState("planning")).toBe("planning");
    expect(coerceAgentState("executing")).toBe("executing");
    expect(coerceAgentState("blocked")).toBe("blocked");
    expect(coerceAgentState("done")).toBe("done");
    expect(coerceAgentState("wat")).toBeUndefined();
  });

  it("accepts self-report event types", () => {
    expect(coerceAgentEventType("status_report")).toBe("status_report");
    expect(coerceAgentEventType("skill_start")).toBe("skill_start");
    expect(coerceAgentEventType("skill_end")).toBe("skill_end");
    expect(coerceAgentEventType("unknown")).toBeUndefined();
  });

  it("reduces status_report into explicit state and text", () => {
    const next = reduceStatus(
      { state: "idle", statusText: "Idle", bubbles: [] },
      {
        eventType: "status_report",
        label: "planning",
        detail: "Reviewing top priority ticket",
        state: "planning",
      },
    );
    expect(next.state).toBe("planning");
    expect(next.statusText).toBe("Reviewing top priority ticket");
    expect(next.bubbles[0]?.label).toBe("planning");
  });

  it("reduces skill_start and skill_end as breadcrumbs", () => {
    const running = reduceStatus(
      { state: "planning", statusText: "Planning", bubbles: [] },
      {
        eventType: "skill_start",
        label: "distribute/affiliate-video-poster",
        detail: "Posting short video",
      },
    );
    expect(running.state).toBe("executing");
    expect(running.statusText).toContain("Posting");
    expect(running.bubbles.some((bubble) => bubble.label.includes("distribute"))).toBe(true);

    const finished = reduceStatus(running, {
      eventType: "skill_end",
      label: "distribute/affiliate-video-poster",
      detail: "Post finished",
    });
    expect(finished.state).toBe("planning");
    expect(finished.statusText).toContain("finished");
  });
});

