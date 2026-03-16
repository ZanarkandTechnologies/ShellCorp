import { describe, expect, it } from "vitest";

import { getOfficePresentationRotationY, getOfficeSceneViewState } from "./view-profile";

describe("office scene view profile", () => {
  it("keeps free orbit controls fully interactive when enabled", () => {
    const state = getOfficeSceneViewState({
      isBuilderMode: false,
      isDragging: false,
      settings: {
        viewProfile: "free_orbit_3d",
        orbitControlsEnabled: true,
        cameraOrientation: "south_east",
      },
    });

    expect(state.cameraPosition).toEqual([0, 25, 30]);
    expect(state.cameraProjection).toBe("perspective");
    expect(state.controlsEnabled).toBe(true);
    expect(state.rotateEnabled).toBe(true);
    expect(state.panEnabled).toBe(true);
  });

  it("uses an orthographic isometric camera for fixed 2.5D", () => {
    const state = getOfficeSceneViewState({
      isBuilderMode: false,
      isDragging: false,
      settings: {
        viewProfile: "fixed_2_5d",
        orbitControlsEnabled: true,
        cameraOrientation: "north_east",
      },
    });

    expect(state.cameraProjection).toBe("orthographic");
    expect(state.cameraPosition).toEqual([26, 18, -26]);
    expect(state.cameraTarget).toEqual([0, 0, 0]);
    expect(state.cameraZoom).toBeGreaterThan(1);
    expect(state.controlsEnabled).toBe(true);
    expect(state.rotateEnabled).toBe(false);
    expect(state.panEnabled).toBe(true);
  });

  it("forces perspective framing when consult mode overrides fixed 2.5D", () => {
    const state = getOfficeSceneViewState({
      isBuilderMode: false,
      isDragging: false,
      settings: {
        viewProfile: "fixed_2_5d",
        orbitControlsEnabled: true,
        cameraOrientation: "north_east",
      },
      forcePerspective: true,
    });

    expect(state.cameraProjection).toBe("perspective");
    expect(state.cameraPosition).toEqual([0, 25, 30]);
    expect(state.rotateEnabled).toBe(true);
  });

  it("falls back to builder camera behavior while editing the office", () => {
    const state = getOfficeSceneViewState({
      isBuilderMode: true,
      isDragging: false,
      settings: {
        viewProfile: "fixed_2_5d",
        orbitControlsEnabled: false,
        cameraOrientation: "south_west",
      },
    });

    expect(state.cameraPosition).toEqual([0, 50, 0]);
    expect(state.cameraProjection).toBe("perspective");
    expect(state.cameraZoom).toBe(1);
    expect(state.rotateEnabled).toBe(false);
    expect(state.panEnabled).toBe(true);
  });

  it("maps presentation yaw to the active fixed-view corner", () => {
    expect(getOfficePresentationRotationY("south_west")).toBeCloseTo(-Math.PI / 4);
    expect(getOfficePresentationRotationY("north_east")).toBeCloseTo((3 * Math.PI) / 4);
  });
});
