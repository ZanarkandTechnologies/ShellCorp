import { describe, expect, it } from "vitest";

import {
  applyOfficeLayoutPaint,
  clampPositionToOfficeLayout,
  createRectangularOfficeLayout,
  expandOfficeLayoutRemovalStroke,
  fillEnclosedOfficeLayoutGaps,
  getOfficeFootprintFromLayout,
  getOfficeLayoutWallSegments,
  normalizeOfficeLayout,
  officeLayoutTileKey,
} from "./office-layout";

describe("office layout helpers", () => {
  it("normalizes legacy rectangles into full tile masks", () => {
    const layout = normalizeOfficeLayout(null, { width: 3, depth: 3 });
    expect(layout.tiles).toHaveLength(9);
    expect(layout.tiles).toContain(officeLayoutTileKey(0, 0));
    expect(getOfficeFootprintFromLayout(layout)).toEqual({ width: 3, depth: 3 });
  });

  it("adds and removes tiles without allowing empty layouts", () => {
    const base = createRectangularOfficeLayout({ width: 3, depth: 3 });
    const withWing = applyOfficeLayoutPaint(base, [officeLayoutTileKey(2, 0)], "add");
    expect(withWing.tiles).toContain(officeLayoutTileKey(2, 0));

    const removedCenter = applyOfficeLayoutPaint(withWing, [officeLayoutTileKey(0, 0)], "remove");
    expect(removedCenter.tiles).not.toContain(officeLayoutTileKey(0, 0));
  });

  it("clamps positions to the nearest valid tile and exposes perimeter walls", () => {
    const layout = normalizeOfficeLayout(
      { tiles: [officeLayoutTileKey(0, 0), officeLayoutTileKey(1, 0)] },
      { width: 3, depth: 3 },
    );
    expect(clampPositionToOfficeLayout([4, 0, 4], layout, 0)).toEqual([1, 0, 0]);
    expect(getOfficeLayoutWallSegments(layout)).toHaveLength(6);
  });

  it("fills enclosed holes after drawing a closed outline", () => {
    const outline = normalizeOfficeLayout(
      {
        tiles: [
          "-1:-1", "0:-1", "1:-1",
          "-1:0", "1:0",
          "-1:1", "0:1", "1:1",
        ],
      },
      { width: 3, depth: 3 },
    );
    const filled = fillEnclosedOfficeLayoutGaps(outline);
    expect(filled.tiles).toContain("0:0");
  });

  it("expands a closed shovel outline to include its interior", () => {
    const layout = createRectangularOfficeLayout({ width: 5, depth: 5 });
    const expanded = expandOfficeLayoutRemovalStroke(layout, [
      "-1:-1", "0:-1", "1:-1",
      "-1:0", "1:0",
      "-1:1", "0:1", "1:1",
    ]);
    expect(expanded.has("0:0")).toBe(true);
  });
});
