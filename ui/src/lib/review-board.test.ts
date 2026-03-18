import { describe, expect, it } from "vitest";

import { countReviewLaneTasks, resolveReviewBoardTasks } from "./review-board";

describe("review board helpers", () => {
  it("falls back to mock tasks after the shared board loads empty", () => {
    const resolved = resolveReviewBoardTasks({
      convexEnabled: true,
      hasLoaded: true,
      rows: [],
    });

    expect(resolved.isMock).toBe(true);
    expect(resolved.tasks).toHaveLength(3);
    expect(countReviewLaneTasks(resolved.tasks)).toBe(2);
  });

  it("keeps live tasks when board data exists", () => {
    const resolved = resolveReviewBoardTasks({
      convexEnabled: true,
      hasLoaded: true,
      rows: [
        {
          taskId: "task-live",
          projectId: "ceo-board",
          title: "Live planning task",
          status: "review",
          approvalState: "approved",
        },
      ],
    });

    expect(resolved.isMock).toBe(false);
    expect(resolved.tasks).toEqual([
      expect.objectContaining({
        id: "task-live",
        title: "Live planning task",
        approvalState: "approved",
      }),
    ]);
  });
});
