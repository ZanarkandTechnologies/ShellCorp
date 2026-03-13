import { describe, expect, it } from "vitest";

import {
  canObjectScale,
  getNextRotationY,
  getNextUniformScale,
} from "./object-transform-panel.helpers";

describe("object transform panel helpers", () => {
  it("blocks scaling for team clusters", () => {
    expect(canObjectScale("team-cluster")).toBe(false);
  });

  it("allows scaling for regular office objects", () => {
    expect(canObjectScale("custom-mesh")).toBe(true);
    expect(canObjectScale("plant")).toBe(true);
  });

  it("accumulates rotation deltas from the latest draft value", () => {
    const once = getNextRotationY(0, "right");
    const twice = getNextRotationY(once, "right");
    expect(once).toBeCloseTo(Math.PI / 2);
    expect(twice).toBeCloseTo(Math.PI);
  });

  it("clamps scale changes to the supported range", () => {
    expect(getNextUniformScale(1, 0.2)).toBe(1.2);
    expect(getNextUniformScale(2.9, 0.2)).toBe(3);
    expect(getNextUniformScale(0.5, -0.2)).toBe(0.4);
  });
});
