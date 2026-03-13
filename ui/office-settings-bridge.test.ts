import { describe, expect, it } from "vitest";

import { normalizeBridgeOfficeSettings } from "./office-settings-bridge";

describe("office settings bridge normalization", () => {
  it("preserves irregular officeLayout tiles instead of rebuilding from the bounding rectangle", () => {
    const normalized = normalizeBridgeOfficeSettings(
      {
        officeFootprint: { width: 35, depth: 35 },
        officeLayout: {
          version: 1,
          tileSize: 1,
          tiles: ["0:0", "1:0", "0:1"],
        },
        decor: {},
      },
      "/tmp/meshes",
    );

    expect(normalized.officeLayout.tiles).toEqual(["0:0", "1:0", "0:1"]);
    expect(normalized.officeFootprint).toEqual({ width: 2, depth: 2 });
  });
});
