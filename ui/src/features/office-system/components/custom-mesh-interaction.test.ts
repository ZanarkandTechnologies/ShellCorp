import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { deriveCustomMeshInteractionBounds } from "./custom-mesh-interaction";

describe("deriveCustomMeshInteractionBounds", () => {
  it("preserves mesh footprint and applies ground offset to the center", () => {
    const bounds = deriveCustomMeshInteractionBounds(
      new THREE.Box3(new THREE.Vector3(-2, -1, -3), new THREE.Vector3(2, 5, 3)),
      1,
    );

    expect(bounds.center).toEqual([0, 3, 0]);
    expect(bounds.size).toEqual([4, 6, 6]);
    expect(bounds.highlightRadius).toBeCloseTo(3.3, 5);
  });

  it("clamps tiny bounds so the proxy hitbox remains usable", () => {
    const bounds = deriveCustomMeshInteractionBounds(
      new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, 0.2, 0.3)),
      0,
    );

    expect(bounds.size).toEqual([0.6, 0.6, 0.6]);
    expect(bounds.highlightRadius).toBe(0.85);
  });
});
