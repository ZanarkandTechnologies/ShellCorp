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
    expect(coerceAgentEventType("activity_log")).toBe("activity_log");
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
        skillId: "world-monitor",
      },
    );
    expect(next.state).toBe("planning");
    expect(next.statusText).toBe("Reviewing top priority ticket");
    expect(next.currentSkillId).toBe("world-monitor");
    expect(next.bubbles[0]?.label).toBe("planning");
  });

  it("reduces skill_start and skill_end as breadcrumbs", () => {
    const running = reduceStatus(
      { state: "planning", statusText: "Planning", bubbles: [] },
      {
        eventType: "skill_start",
        label: "distribute/affiliate-video-poster",
        detail: "Posting short video",
        skillId: "distribute/affiliate-video-poster",
      },
    );
    expect(running.state).toBe("executing");
    expect(running.statusText).toContain("Posting");
    expect(running.currentSkillId).toBe("distribute/affiliate-video-poster");
    expect(running.bubbles.some((bubble) => bubble.label.includes("distribute"))).toBe(true);

    const finished = reduceStatus(running, {
      eventType: "skill_end",
      label: "distribute/affiliate-video-poster",
      detail: "Post finished",
    });
    expect(finished.state).toBe("planning");
    expect(finished.statusText).toContain("finished");
    expect(finished.currentSkillId).toBeUndefined();
  });

  it("maps activity_log transitions into live state", () => {
    const planning = reduceStatus(
      { state: "idle", statusText: "Idle", bubbles: [] },
      {
        eventType: "activity_log",
        activityType: "planning",
        label: "planning",
        detail: "Planning next move",
        skillId: "world-monitor",
      },
    );
    expect(planning.state).toBe("planning");
    expect(planning.statusText).toBe("Planning next move");
    expect(planning.currentSkillId).toBe("world-monitor");

    const blocked = reduceStatus(planning, {
      eventType: "activity_log",
      activityType: "blocked",
      label: "blocked",
      detail: "Waiting on credentials",
    });
    expect(blocked.state).toBe("blocked");
    expect(blocked.bubbles[0]?.label).toBe("Error");

    const finished = reduceStatus(blocked, {
      eventType: "activity_log",
      activityType: "summary",
      label: "summary",
      detail: "Turn complete",
    });
    expect(finished.state).toBe("done");
    expect(finished.statusText).toBe("Turn complete");
    expect(finished.currentSkillId).toBeUndefined();
  });
});
