/**
 * OFFICE PLACEMENT
 * ================
 * Purpose
 * - Provide deterministic footprint + occupancy checks for CLI placement.
 *
 * KEY CONCEPTS:
 * - All collision checks are on XZ plane using simple AABB footprints.
 * - Auto placement uses expanding square-ring scan from a fixed origin.
 *
 * USAGE:
 * - isPlacementAreaFree(...)
 * - findFirstOpenPlacement(...)
 *
 * MEMORY REFERENCES:
 * - MEM-0120
 */
import type { OfficeObjectModel } from "./sidecar-store.js";

export interface PlacementFootprint {
  width: number;
  depth: number;
  clearance: number;
}

export interface PlacementBounds {
  halfExtent: number;
}

export interface AutoPlacementInput {
  meshType: string;
  metadata?: Record<string, unknown>;
  existingObjects: OfficeObjectModel[];
  bounds: PlacementBounds;
  gridStep?: number;
}

const DEFAULT_FOOTPRINT: PlacementFootprint = { width: 2, depth: 2, clearance: 0 };
const FOOTPRINT_BY_MESH: Record<string, PlacementFootprint> = {
  "team-cluster": { width: 4, depth: 4, clearance: 0.5 },
  plant: { width: 1, depth: 1, clearance: 0.2 },
  couch: { width: 3, depth: 2, clearance: 0.25 },
  bookshelf: { width: 2, depth: 1, clearance: 0.2 },
  pantry: { width: 2, depth: 2, clearance: 0.25 },
  "glass-wall": { width: 1, depth: 3, clearance: 0.1 },
  "custom-mesh": { width: 2, depth: 2, clearance: 0.25 },
};

function asFinitePositive(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function asFiniteNonNegative(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function normalizeGridStep(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return 1;
  return raw;
}

export function getMeshFootprint(meshType: string, metadata?: Record<string, unknown>): PlacementFootprint {
  const base = FOOTPRINT_BY_MESH[meshType] ?? DEFAULT_FOOTPRINT;
  const meta = metadata ?? {};
  const width = asFinitePositive(meta.footprintWidth) ?? base.width;
  const depth = asFinitePositive(meta.footprintDepth) ?? base.depth;
  const clearance = asFiniteNonNegative(meta.footprintClearance) ?? base.clearance;
  return { width, depth, clearance };
}

function effectiveHalfWidth(footprint: PlacementFootprint): number {
  return footprint.width / 2 + footprint.clearance;
}

function effectiveHalfDepth(footprint: PlacementFootprint): number {
  return footprint.depth / 2 + footprint.clearance;
}

function isCenterInsideBounds(position: [number, number, number], footprint: PlacementFootprint, bounds: PlacementBounds): boolean {
  const [x, , z] = position;
  const halfWidth = effectiveHalfWidth(footprint);
  const halfDepth = effectiveHalfDepth(footprint);
  const limit = bounds.halfExtent;
  return x >= -limit + halfWidth && x <= limit - halfWidth && z >= -limit + halfDepth && z <= limit - halfDepth;
}

function intersectsXZ(
  leftPos: [number, number, number],
  leftFootprint: PlacementFootprint,
  rightPos: [number, number, number],
  rightFootprint: PlacementFootprint,
): boolean {
  const dx = Math.abs(leftPos[0] - rightPos[0]);
  const dz = Math.abs(leftPos[2] - rightPos[2]);
  const overlapX = dx < effectiveHalfWidth(leftFootprint) + effectiveHalfWidth(rightFootprint);
  const overlapZ = dz < effectiveHalfDepth(leftFootprint) + effectiveHalfDepth(rightFootprint);
  return overlapX && overlapZ;
}

export function isPlacementAreaFree(input: {
  position: [number, number, number];
  meshType: string;
  metadata?: Record<string, unknown>;
  existingObjects: OfficeObjectModel[];
  bounds: PlacementBounds;
  ignoreObjectId?: string;
}): boolean {
  const targetFootprint = getMeshFootprint(input.meshType, input.metadata);
  if (!isCenterInsideBounds(input.position, targetFootprint, input.bounds)) {
    return false;
  }
  for (const object of input.existingObjects) {
    if (input.ignoreObjectId && object.id === input.ignoreObjectId) continue;
    if (intersectsXZ(input.position, targetFootprint, object.position, getMeshFootprint(object.meshType, object.metadata))) {
      return false;
    }
  }
  return true;
}

function snap(raw: number, step: number): number {
  return Math.round(raw / step) * step;
}

export function findFirstOpenPlacement(input: AutoPlacementInput): [number, number, number] | null {
  const step = normalizeGridStep(input.gridStep);
  const maxRing = Math.ceil((input.bounds.halfExtent * 2) / step) + 2;
  const originX = 0;
  const originZ = 0;
  const metadata = input.metadata ?? {};

  for (let ring = 0; ring <= maxRing; ring += 1) {
    for (let dz = -ring; dz <= ring; dz += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const candidate: [number, number, number] = [snap(originX + dx * step, step), 0, snap(originZ + dz * step, step)];
        if (
          isPlacementAreaFree({
            position: candidate,
            meshType: input.meshType,
            metadata,
            existingObjects: input.existingObjects,
            bounds: input.bounds,
          })
        ) {
          return candidate;
        }
      }
    }
  }
  return null;
}

