import { describe, expect, it } from "vitest";

import { toOfficeObjectSidecar, toOfficeSettings } from "./_normalize";

describe("office settings normalization", () => {
  it("fills view defaults when older payloads omit them", () => {
    expect(toOfficeSettings({ meshAssetDir: "/tmp/assets" })).toMatchObject({
      meshAssetDir: "/tmp/assets",
      decor: {
        floorPatternId: "sandstone_tiles",
        wallColorId: "gallery_cream",
        backgroundId: "shell_haze",
      },
      viewProfile: "free_orbit_3d",
      orbitControlsEnabled: true,
      cameraOrientation: "south_east",
    });
  });

  it("accepts persisted fixed-view settings", () => {
    expect(
      toOfficeSettings({
        decor: {
          floorPatternId: "graphite_grid",
          wallColorId: "sage_mist",
          backgroundId: "kelp_fog",
        },
        viewProfile: "fixed_2_5d",
        orbitControlsEnabled: false,
        cameraOrientation: "north_west",
      }),
    ).toMatchObject({
      decor: {
        floorPatternId: "graphite_grid",
        wallColorId: "sage_mist",
        backgroundId: "kelp_fog",
      },
      viewProfile: "fixed_2_5d",
      orbitControlsEnabled: false,
      cameraOrientation: "north_west",
    });
  });

  it("accepts wall-art office objects", () => {
    expect(
      toOfficeObjectSidecar({
        id: "wall-art-back-center",
        identifier: "wall-art-back-center",
        meshType: "wall-art",
        position: [0, 3, -10],
        rotation: [0, 0, 0],
        metadata: {
          wallSlotId: "back-center",
          paintingPresetId: "sunrise_blocks",
        },
      }),
    ).toMatchObject({
      id: "wall-art-back-center",
      meshType: "wall-art",
      metadata: {
        wallSlotId: "back-center",
        paintingPresetId: "sunrise_blocks",
      },
    });
  });
});
