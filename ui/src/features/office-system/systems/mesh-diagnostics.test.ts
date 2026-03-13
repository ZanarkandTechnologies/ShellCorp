import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { collectMeshDiagnostics, formatMeshDiagnosticsSummary } from "./mesh-diagnostics";

function buildMesh(vertexTriplets: number): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(new Array(vertexTriplets * 9).fill(0), 3),
  );
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
}

describe("mesh diagnostics", () => {
  it("counts nodes, meshes, and triangles from the scene graph", () => {
    const root = new THREE.Group();
    root.add(buildMesh(5));
    root.add(new THREE.Group());

    const diagnostics = collectMeshDiagnostics(
      root,
      new THREE.Box3(new THREE.Vector3(-1, 0, -2), new THREE.Vector3(1, 4, 2)),
    );

    expect(diagnostics.nodeCount).toBe(3);
    expect(diagnostics.meshCount).toBe(1);
    expect(diagnostics.triangleCount).toBe(5);
    expect(diagnostics.size).toEqual([2, 4, 4]);
    expect(diagnostics.warnings).toEqual([]);
  });

  it("flags dense and oversized meshes", () => {
    const root = new THREE.Group();
    root.add(buildMesh(250_000));

    const diagnostics = collectMeshDiagnostics(
      root,
      new THREE.Box3(new THREE.Vector3(-5, 0, -4), new THREE.Vector3(5, 3, 4)),
    );

    expect(diagnostics.warnings).toContain("dense-geometry:250000");
    expect(diagnostics.warnings).toContain("oversized-dimension:10.00");
    expect(diagnostics.warnings).toContain("large-footprint:80.00");
    expect(formatMeshDiagnosticsSummary(diagnostics)).toContain("warnings=");
  });
});
