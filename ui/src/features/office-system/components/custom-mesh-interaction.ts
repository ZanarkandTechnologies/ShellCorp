"use client";

/**
 * CUSTOM MESH INTERACTION
 * =======================
 * Derives cheap interaction bounds for heavy custom meshes so pointer hit-testing stays predictable.
 *
 * KEY CONCEPTS:
 * - Runtime interaction should use a simple proxy hitbox instead of deep mesh raycasts
 * - Bounds come from the cached mesh box so every clone shares the same interaction shape
 * - Highlight radius should track the proxy footprint, not every triangle in the scene clone
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 */

import * as THREE from "three";

export type CustomMeshInteractionBounds = {
  center: [number, number, number];
  size: [number, number, number];
  highlightRadius: number;
};

export function deriveCustomMeshInteractionBounds(
  boundingBox: THREE.Box3,
  groundOffset: number,
): CustomMeshInteractionBounds {
  const sizeVector = boundingBox.getSize(new THREE.Vector3());
  const centerVector = boundingBox.getCenter(new THREE.Vector3());
  const centerY = centerVector.y + groundOffset;
  const safeWidth = Math.max(sizeVector.x, 0.6);
  const safeHeight = Math.max(sizeVector.y, 0.6);
  const safeDepth = Math.max(sizeVector.z, 0.6);

  return {
    center: [centerVector.x, centerY, centerVector.z],
    size: [safeWidth, safeHeight, safeDepth],
    highlightRadius: Math.max(0.85, Math.max(safeWidth, safeDepth) * 0.55),
  };
}
