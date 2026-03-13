import { describe, expect, it, vi } from "vitest";

import type { OfficeSettingsModel } from "@/lib/openclaw-types";

import { saveOfficeSettingsOptimistically } from "./office-layout-save";

function createSettings(tiles: string[]): OfficeSettingsModel {
  return {
    meshAssetDir: "",
    officeFootprint: { width: 3, depth: 3 },
    officeLayout: {
      version: 1,
      tileSize: 1,
      tiles,
    },
    decor: {
      floorPatternId: "sandstone_tiles",
      wallColorId: "gallery_cream",
      backgroundId: "shell_haze",
    },
    viewProfile: "free_orbit_3d",
    orbitControlsEnabled: true,
    cameraOrientation: "south_east",
  };
}

describe("saveOfficeSettingsOptimistically", () => {
  it("applies the next layout before the save resolves and reconciles the response", async () => {
    const previousSettings = createSettings(["0:0"]);
    const nextSettings = createSettings(["0:0", "1:0"]);
    const returnedSettings = createSettings(["0:0", "1:0", "1:1"]);
    const applyOfficeSettings = vi.fn();
    let applyCountBeforeResolve = 0;
    let resolveSave: ((value: { ok: true; settings: OfficeSettingsModel }) => void) | null = null;
    const saveOfficeSettings = vi.fn(
      () =>
        new Promise<{ ok: true; settings: OfficeSettingsModel }>((resolve) => {
          applyCountBeforeResolve = applyOfficeSettings.mock.calls.length;
          resolveSave = resolve;
        }),
    );

    const pending = saveOfficeSettingsOptimistically({
      previousSettings,
      nextSettings,
      applyOfficeSettings,
      saveOfficeSettings,
    });

    expect(applyOfficeSettings).toHaveBeenCalledWith(nextSettings);
    expect(applyCountBeforeResolve).toBe(1);

    resolveSave?.({ ok: true, settings: returnedSettings });
    const result = await pending;

    expect(result).toEqual({ ok: true, settings: returnedSettings });
    expect(applyOfficeSettings).toHaveBeenNthCalledWith(2, returnedSettings);
  });

  it("rolls back the optimistic settings when the save reports a failure", async () => {
    const previousSettings = createSettings(["0:0"]);
    const nextSettings = createSettings(["0:0", "1:0"]);
    const applyOfficeSettings = vi.fn();
    const saveOfficeSettings = vi.fn(async () => ({
      ok: false as const,
      settings: nextSettings,
      error: "office_settings_save_failed:500",
    }));

    const result = await saveOfficeSettingsOptimistically({
      previousSettings,
      nextSettings,
      applyOfficeSettings,
      saveOfficeSettings,
    });

    expect(result.ok).toBe(false);
    expect(applyOfficeSettings).toHaveBeenNthCalledWith(1, nextSettings);
    expect(applyOfficeSettings).toHaveBeenNthCalledWith(2, previousSettings);
  });
});
