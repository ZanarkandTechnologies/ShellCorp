import { describe, expect, it, vi } from "vitest";

import { refreshOfficeDataSafely } from "./office-object-refresh";

describe("refreshOfficeDataSafely", () => {
  it("does not throw when the follow-up refresh fails", async () => {
    const refresh = vi.fn(async () => {
      throw new Error("refresh_failed");
    });
    const logWarning = vi.fn();

    await expect(refreshOfficeDataSafely(refresh, logWarning)).resolves.toBeUndefined();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(logWarning).toHaveBeenCalledTimes(1);
    expect(logWarning.mock.calls[0]?.[0]).toContain("Office data refresh failed");
  });
});
