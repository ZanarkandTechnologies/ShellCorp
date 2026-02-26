import { describe, expect, it } from "vitest";

import { solveClusterLayout, type MeshFootprint } from "./layout";

function centroid(
  transforms: Array<{ x: number; z: number }>,
): { x: number; z: number } {
  return {
    x: transforms.reduce((sum, row) => sum + row.x, 0) / transforms.length,
    z: transforms.reduce((sum, row) => sum + row.z, 0) / transforms.length,
  };
}

describe("solveClusterLayout", () => {
  it("returns a stable transform count for desk counts 1..6", () => {
    for (let count = 1; count <= 6; count += 1) {
      const result = solveClusterLayout(count, {
        width: 2,
        depth: 1,
        clearanceX: 0.2,
        clearanceZ: 0.35,
      });
      expect(result.transforms).toHaveLength(count);
      expect(result.slots).toHaveLength(count);
    }
  });

  it("keeps one desk centered at origin", () => {
    const result = solveClusterLayout(1, {
      width: 2,
      depth: 1,
      clearanceX: 0.2,
      clearanceZ: 0.35,
    });
    expect(result.transforms[0].x).toBeCloseTo(0, 6);
    expect(result.transforms[0].z).toBeCloseTo(0, 6);
  });

  it("uses a facing pair for two desks", () => {
    const result = solveClusterLayout(2, {
      width: 2,
      depth: 1,
      clearanceX: 0.2,
      clearanceZ: 0.35,
    });
    const [a, b] = result.transforms;
    expect(a.x).toBeCloseTo(0, 6);
    expect(b.x).toBeCloseTo(0, 6);
    expect(a.z).toBeLessThan(0);
    expect(b.z).toBeGreaterThan(0);
  });

  it("orients odd tail slot toward centroid for three desks", () => {
    const result = solveClusterLayout(3, {
      width: 2,
      depth: 1,
      clearanceX: 0.2,
      clearanceZ: 0.35,
    });
    const tail = result.transforms.find((row) => row.role === "tail");
    expect(tail).toBeDefined();
    const center = centroid(result.transforms);
    const toCentroidX = center.x - (tail?.x ?? 0);
    const toCentroidZ = center.z - (tail?.z ?? 0);
    const expectedYaw = Math.atan2(-toCentroidX, -toCentroidZ);
    expect(tail?.yaw).toBeCloseTo(expectedYaw, 6);
  });

  it("creates a 2x2 arrangement for four desks", () => {
    const result = solveClusterLayout(4, {
      width: 2,
      depth: 1,
      clearanceX: 0.2,
      clearanceZ: 0.35,
    });
    const uniqueX = [...new Set(result.transforms.map((row) => row.x.toFixed(6)))];
    expect(uniqueX).toHaveLength(2);
  });

  it("adds one tail slot for five desks", () => {
    const result = solveClusterLayout(5, {
      width: 2,
      depth: 1,
      clearanceX: 0.2,
      clearanceZ: 0.35,
    });
    const tails = result.transforms.filter((row) => row.role === "tail");
    expect(tails).toHaveLength(1);
  });

  it("creates a 3x2 arrangement for six desks", () => {
    const result = solveClusterLayout(6, {
      width: 2,
      depth: 1,
      clearanceX: 0.2,
      clearanceZ: 0.35,
    });
    const uniqueX = [...new Set(result.transforms.map((row) => row.x.toFixed(6)))];
    expect(uniqueX).toHaveLength(3);
  });

  it("keeps anchor equal to centroid for default anchor mode", () => {
    const result = solveClusterLayout(5, {
      width: 2,
      depth: 1,
      clearanceX: 0.2,
      clearanceZ: 0.35,
    });
    const center = centroid(result.transforms);
    expect(result.anchor.x).toBeCloseTo(center.x, 6);
    expect(result.anchor.z).toBeCloseTo(center.z, 6);
  });

  it("works with non-desk footprints", () => {
    const wideBench: MeshFootprint = {
      width: 3.4,
      depth: 1.6,
      clearanceX: 0.3,
      clearanceZ: 0.8,
    };
    const result = solveClusterLayout(4, wideBench);
    const xs = result.transforms.map((row) => row.x);
    const spread = Math.max(...xs) - Math.min(...xs);
    expect(spread).toBeCloseTo(wideBench.width + wideBench.clearanceX, 6);
  });
});
