import { describe, expect, it } from "vitest";
import { buildTeamTimelineRows } from "./team-timeline";

describe("team timeline helpers", () => {
  it("prefers convex timeline rows when available", () => {
    const rows = buildTeamTimelineRows({
      convexTimeline: [
        {
          _id: "row-1",
          sourceType: "agent_event",
          occurredAt: 10,
          projectId: "proj-a",
          agentId: "agent-a",
          label: "Started",
        },
      ],
      communicationRows: [],
      projectId: "proj-a",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.label).toBe("Started");
  });

  it("falls back to communication rows for timeline rendering", () => {
    const rows = buildTeamTimelineRows({
      convexTimeline: undefined,
      communicationRows: [
        {
          id: "comm-1",
          agentId: "agent-b",
          activityType: "executing",
          label: "Working task",
          occurredAt: 123,
          taskId: "task-1",
        },
      ],
      projectId: "proj-b",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sourceType).toBe("agent_event");
    expect(rows[0]?.projectId).toBe("proj-b");
    expect(rows[0]?.taskId).toBe("task-1");
  });

  it("falls back to communication rows when convex returns empty array", () => {
    const rows = buildTeamTimelineRows({
      convexTimeline: [],
      communicationRows: [
        {
          id: "comm-2",
          agentId: "agent-c",
          activityType: "planning",
          label: "Queue built",
          occurredAt: 456,
        },
      ],
      projectId: "proj-c",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.label).toBe("Queue built");
  });
});
