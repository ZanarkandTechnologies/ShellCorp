"use client";

/**
 * MESH DIAGNOSTICS
 * ================
 * Computes lightweight risk signals for custom mesh assets so oversized office props are obvious in development.
 *
 * KEY CONCEPTS:
 * - Diagnostics run once per loaded mesh and should stay cheaper than the render path they protect
 * - Guardrails focus on the failure modes that hurt office interaction most: huge bounds and dense geometry
 * - Warnings are advisory in dev; runtime interaction still relies on proxy hitboxes for safety
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 * - MEM-0165
 */

import * as THREE from "three";

export type MeshDiagnostics = {
  meshCount: number;
  nodeCount: number;
  triangleCount: number;
  size: [number, number, number];
  maxDimension: number;
  footprintArea: number;
  warnings: string[];
};

const TRIANGLE_WARNING_THRESHOLD = 200_000;
const MAX_DIMENSION_WARNING_THRESHOLD = 8;
const FOOTPRINT_WARNING_THRESHOLD = 36;
const NODE_WARNING_THRESHOLD = 250;

export function collectMeshDiagnostics(
  scene: THREE.Object3D,
  boundingBox: THREE.Box3,
): MeshDiagnostics {
  let nodeCount = 0;
  let meshCount = 0;
  let triangleCount = 0;

  scene.traverse((child) => {
    nodeCount += 1;
    if (!("isMesh" in child) || !child.isMesh) {
      return;
    }

    meshCount += 1;

    const geometry = child.geometry;
    if (!geometry) {
      return;
    }

    if (geometry.index) {
      triangleCount += Math.floor(geometry.index.count / 3);
      return;
    }

    const positions = geometry.getAttribute("position");
    if (positions) {
      triangleCount += Math.floor(positions.count / 3);
    }
  });

  const sizeVector = boundingBox.getSize(new THREE.Vector3());
  const size: [number, number, number] = [sizeVector.x, sizeVector.y, sizeVector.z];
  const maxDimension = Math.max(...size);
  const footprintArea = sizeVector.x * sizeVector.z;
  const warnings: string[] = [];

  if (triangleCount >= TRIANGLE_WARNING_THRESHOLD) {
    warnings.push(`dense-geometry:${triangleCount}`);
  }
  if (maxDimension >= MAX_DIMENSION_WARNING_THRESHOLD) {
    warnings.push(`oversized-dimension:${maxDimension.toFixed(2)}`);
  }
  if (footprintArea >= FOOTPRINT_WARNING_THRESHOLD) {
    warnings.push(`large-footprint:${footprintArea.toFixed(2)}`);
  }
  if (nodeCount >= NODE_WARNING_THRESHOLD) {
    warnings.push(`many-nodes:${nodeCount}`);
  }

  return {
    meshCount,
    nodeCount,
    triangleCount,
    size,
    maxDimension,
    footprintArea,
    warnings,
  };
}

export function formatMeshDiagnosticsSummary(diagnostics: MeshDiagnostics): string {
  return [
    `nodes=${diagnostics.nodeCount}`,
    `meshes=${diagnostics.meshCount}`,
    `triangles=${diagnostics.triangleCount}`,
    `size=${diagnostics.size.map((value) => value.toFixed(2)).join("x")}`,
    `footprint=${diagnostics.footprintArea.toFixed(2)}`,
    diagnostics.warnings.length > 0 ? `warnings=${diagnostics.warnings.join(",")}` : "warnings=none",
  ].join(" ");
}
