import { describe, expect, it } from "vitest";

import { countSc12PendingReviewTasks, resolveSc12BoardTasks } from "./sc12-board";

describe("sc12 board helpers", () => {
  it("falls back to mock tasks after the shared board loads empty", () => {
    const resolved = resolveSc12BoardTasks({
      convexEnabled: true,
      hasLoaded: true,
      rows: [],
    });

    expect(resolved.isMock).toBe(true);
    expect(resolved.tasks).toHaveLength(3);
    expect(countSc12PendingReviewTasks(resolved.tasks)).toBe(2);
  });

  it("keeps live tasks when board data exists", () => {
    const resolved = resolveSc12BoardTasks({
      convexEnabled: true,
      hasLoaded: true,
      rows: [
        {
          taskId: "task-live",
          projectId: "ceo-board",
          title: "Live proposal",
          status: "todo",
          approvalState: "approved",
        },
      ],
    });

    expect(resolved.isMock).toBe(false);
    expect(resolved.tasks).toEqual([
      expect.objectContaining({
        id: "task-live",
        title: "Live proposal",
        approvalState: "approved",
      }),
    ]);
  });
});
