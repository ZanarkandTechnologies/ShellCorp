import { describe, expect, it } from "vitest";

import {
  DEFAULT_OFFICE_FOOTPRINT,
  MIN_OFFICE_FOOTPRINT,
  clampPositionToOfficeFootprint,
  getManagementAnchorFromFootprint,
  normalizeOfficeFootprint,
  shrinkOfficeFootprint,
} from "./office-footprint";

describe("office footprint", () => {
  it("normalizes missing values to defaults", () => {
    expect(normalizeOfficeFootprint({})).toEqual(DEFAULT_OFFICE_FOOTPRINT);
  });

  it("keeps footprint axes odd and above minimum", () => {
    expect(normalizeOfficeFootprint({ width: 24, depth: 10 })).toEqual({
      width: 25,
      depth: MIN_OFFICE_FOOTPRINT,
    });
  });

  it("clamps positions within half extents", () => {
    expect(clampPositionToOfficeFootprint([20, 0, -20], { width: 21, depth: 19 }, 1)).toEqual([
      9.5,
      0,
      -8.5,
    ]);
  });

  it("stops shrinking at the minimum footprint", () => {
    expect(shrinkOfficeFootprint({ width: MIN_OFFICE_FOOTPRINT, depth: MIN_OFFICE_FOOTPRINT })).toEqual({
      width: MIN_OFFICE_FOOTPRINT,
      depth: MIN_OFFICE_FOOTPRINT,
    });
  });

  it("derives a management anchor from the current room size", () => {
    expect(getManagementAnchorFromFootprint({ width: 35, depth: 41 })).toEqual([0, 0, 16.5]);
  });
});
