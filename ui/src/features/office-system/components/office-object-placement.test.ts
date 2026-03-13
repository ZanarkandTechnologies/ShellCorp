import { describe, expect, it } from "vitest";

import { normalizeOfficeLayout, officeLayoutTileKey } from "../../../lib/office-layout";

import {
  constrainOfficeObjectPositionForLayout,
  getOfficeObjectPlacementMargin,
} from "./office-object-placement";

describe("office object placement", () => {
  it("uses a larger placement margin for team clusters", () => {
    expect(getOfficeObjectPlacementMargin("plant")).toBe(1);
    expect(getOfficeObjectPlacementMargin("team-cluster")).toBe(2);
  });

  it("snaps drag positions to tile centers before clamping to the live office layout", () => {
    const layout = normalizeOfficeLayout(
      {
        tiles: [
          officeLayoutTileKey(0, 0),
          officeLayoutTileKey(1, 0),
          officeLayoutTileKey(2, 0),
          officeLayoutTileKey(3, 0),
          officeLayoutTileKey(4, 0),
          officeLayoutTileKey(0, 1),
          officeLayoutTileKey(1, 1),
          officeLayoutTileKey(2, 1),
          officeLayoutTileKey(3, 1),
          officeLayoutTileKey(4, 1),
          officeLayoutTileKey(0, 2),
          officeLayoutTileKey(1, 2),
          officeLayoutTileKey(2, 2),
          officeLayoutTileKey(3, 2),
          officeLayoutTileKey(4, 2),
        ],
      },
      { width: 5, depth: 3 },
    );

    expect(constrainOfficeObjectPositionForLayout([2.6, 0, 1.2], layout, "plant")).toEqual([
      3, 0, 1,
    ]);
    expect(constrainOfficeObjectPositionForLayout([3.2, 0, 1.1], layout, "plant")).toEqual([
      3, 0, 1,
    ]);
  });
});
