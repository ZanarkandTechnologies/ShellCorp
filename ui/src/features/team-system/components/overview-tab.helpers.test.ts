import { describe, expect, it } from "vitest";

import { formatRelativeTime, resolvePreviewPalette } from "./overview-tab.helpers";

describe("overview tab helpers", () => {
  it("keeps preview palettes deterministic for the same employee seed", () => {
    const first = resolvePreviewPalette("employee-growth:Solo Affiliate Lab");
    const second = resolvePreviewPalette("employee-growth:Solo Affiliate Lab");

    expect(second).toEqual(first);
  });

  it("returns a terse no-update label when there is no timestamp", () => {
    expect(formatRelativeTime(undefined, 1_000_000)).toBe("No recent update");
  });

  it("renders hour-based update labels for older task activity", () => {
    expect(formatRelativeTime(1_000_000, 1_000_000 + 2 * 3_600_000)).toBe("Updated 2h ago");
  });
});
