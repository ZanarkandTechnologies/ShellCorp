import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

describe("a-star pathfinding initialization", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("reports grid readiness after initialization", async () => {
    const pathfinding = await import("./a-star-pathfinding");

    expect(pathfinding.isGridInitialized()).toBe(false);

    pathfinding.initializeGrid(10, []);

    expect(pathfinding.isGridInitialized()).toBe(true);
  });

  it("supports rectangular footprints", async () => {
    const pathfinding = await import("./a-star-pathfinding");

    pathfinding.initializeGrid({ width: 12, depth: 8 }, []);
    const grid = pathfinding.getGridData();

    expect(grid.floorWidth).toBe(12);
    expect(grid.floorDepth).toBe(8);
    expect(grid.gridWidth).toBe(24);
    expect(grid.gridDepth).toBe(16);
  });

  it("warns only once before the grid is initialized", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pathfinding = await import("./a-star-pathfinding");
    const start = new THREE.Vector3(0, 0, 0);
    const end = new THREE.Vector3(1, 0, 1);

    expect(pathfinding.findPathAStar(start, end)).toBeNull();
    expect(pathfinding.findPathAStar(start, end)).toBeNull();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("A* grid not initialized yet");

    warnSpy.mockRestore();
  });
});
