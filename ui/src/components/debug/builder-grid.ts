/**
 * BUILDER GRID
 * ============
 * Pure geometry helpers for the builder-mode tile overlay grid.
 *
 * KEY CONCEPTS:
 * - Builder grid lines must align exactly to office layout tile boundaries.
 * - Geometry stays pure so regressions can be caught without mounting the scene.
 *
 * USAGE:
 * - Import from `unified-grid-helper.tsx` to render the overlay.
 * - Import from tests to validate rectangular and square layouts.
 *
 * MEMORY REFERENCES:
 * - MEM-0173
 */

import type { OfficeLayoutBounds } from '../../lib/office-layout';

export function getBuilderGridLinePositions(bounds: OfficeLayoutBounds): Float32Array {
  const points: number[] = [];
  for (let x = bounds.minWorldX; x <= bounds.maxWorldX + 0.001; x += 1) {
    points.push(x, 0.01, bounds.minWorldZ, x, 0.01, bounds.maxWorldZ);
  }
  for (let z = bounds.minWorldZ; z <= bounds.maxWorldZ + 0.001; z += 1) {
    points.push(bounds.minWorldX, 0.01, z, bounds.maxWorldX, 0.01, z);
  }
  return new Float32Array(points);
}
