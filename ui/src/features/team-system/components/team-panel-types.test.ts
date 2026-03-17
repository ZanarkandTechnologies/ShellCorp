import { describe, expect, it } from "vitest";
import {
  deriveAgentPresenceRows,
  type CommunicationRow,
  type PanelTask,
  type PresenceEmployee,
} from "./team-panel-types";

describe("deriveAgentPresenceRows", () => {
  it("prefers an active assigned task over older completed work", () => {
    const employees: PresenceEmployee[] = [
      {
        _id: "employee-growth",
        name: "Growth Marketer",
        jobTitle: "growth_marketer",
        status: "executing",
        statusMessage: "Refreshing affiliate content",
      },
    ];
    const tasks: PanelTask[] = [
      {
        id: "task-done",
        title: "Old completed task",
        status: "done",
        ownerAgentId: "growth",
        priority: "high",
        provider: "internal",
        syncState: "healthy",
        updatedAt: 10,
      },
      {
        id: "task-live",
        title: "Publish roundup",
        status: "in_progress",
        ownerAgentId: "growth",
        priority: "medium",
        provider: "internal",
        syncState: "healthy",
        updatedAt: 20,
      },
    ];
    const rows = deriveAgentPresenceRows({
      employees,
      projectTasks: tasks,
      communicationRows: [],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.agentId).toBe("growth");
    expect(rows[0]?.latestTaskTitle).toBe("Publish roundup");
    expect(rows[0]?.latestTaskStatus).toBe("in_progress");
    expect(rows[0]?.openTaskCount).toBe(1);
    expect(rows[0]?.completedTaskCount).toBe(1);
  });

  it("falls back to recent communication when no task is assigned", () => {
    const employees: PresenceEmployee[] = [
      {
        _id: "employee-pm",
        name: "PM",
        jobTitle: "pm",
      },
    ];
    const communicationRows: CommunicationRow[] = [
      {
        id: "comm-1",
        agentId: "pm",
        activityType: "planning",
        label: "Queue shaped",
        detail: "Reviewing next affiliate batch",
        occurredAt: 123,
      },
    ];

    const rows = deriveAgentPresenceRows({
      employees,
      projectTasks: [],
      communicationRows,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.latestTaskTitle).toBeUndefined();
    expect(rows[0]?.statusText).toBe("Reviewing next affiliate batch");
    expect(rows[0]?.latestOccurredAt).toBe(123);
  });

  it("sorts agents by freshest active context", () => {
    const employees: PresenceEmployee[] = [
      { _id: "employee-alpha", name: "Alpha" },
      { _id: "employee-beta", name: "Beta" },
    ];
    const tasks: PanelTask[] = [
      {
        id: "task-beta",
        title: "Active task",
        status: "in_progress",
        ownerAgentId: "beta",
        priority: "high",
        provider: "internal",
        syncState: "healthy",
        updatedAt: 200,
      },
    ];
    const communicationRows: CommunicationRow[] = [
      {
        id: "comm-alpha",
        agentId: "alpha",
        activityType: "planning",
        label: "Backlog updated",
        occurredAt: 100,
      },
    ];

    const rows = deriveAgentPresenceRows({
      employees,
      projectTasks: tasks,
      communicationRows,
    });

    expect(rows.map((row) => row.agentId)).toEqual(["beta", "alpha"]);
  });
});
