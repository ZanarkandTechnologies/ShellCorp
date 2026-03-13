/**
 * OFFICE FOOTPRINT
 * ================
 * Shared helpers for the persisted office room dimensions.
 *
 * KEY CONCEPTS:
 * - The office room stays rectangular in v1 so builder resizing can remain deterministic.
 * - Rendering, pathfinding, placement, and bounds checks should all consume one normalized footprint.
 *
 * USAGE:
 * - Normalize persisted office settings.
 * - Clamp object/team positions and validate resize actions.
 *
 * MEMORY REFERENCES:
 * - MEM-0165
 */

export interface OfficeFootprint {
  width: number;
  depth: number;
}

export const DEFAULT_OFFICE_FOOTPRINT: OfficeFootprint = {
  width: 35,
  depth: 35,
};

export const OFFICE_FOOTPRINT_STEP = 2;
export const MIN_OFFICE_FOOTPRINT = 15;

function normalizeAxis(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < MIN_OFFICE_FOOTPRINT) return MIN_OFFICE_FOOTPRINT;
  return rounded % 2 === 0 ? rounded + 1 : rounded;
}

export function normalizeOfficeFootprint(value: unknown): OfficeFootprint {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    width: normalizeAxis(row.width, DEFAULT_OFFICE_FOOTPRINT.width),
    depth: normalizeAxis(row.depth, DEFAULT_OFFICE_FOOTPRINT.depth),
  };
}

export function getOfficeFootprintHalfExtents(footprint: OfficeFootprint): {
  halfWidth: number;
  halfDepth: number;
} {
  return {
    halfWidth: footprint.width / 2,
    halfDepth: footprint.depth / 2,
  };
}

export function getManagementAnchorFromFootprint(
  footprint: OfficeFootprint,
  inset = 4,
): [number, number, number] {
  const { halfDepth } = getOfficeFootprintHalfExtents(footprint);
  return [0, 0, Math.max(0, halfDepth - inset)];
}

export function clampPositionToOfficeFootprint(
  position: [number, number, number],
  footprint: OfficeFootprint,
  margin = 0,
): [number, number, number] {
  const { halfWidth, halfDepth } = getOfficeFootprintHalfExtents(footprint);
  const xLimit = Math.max(0, halfWidth - margin);
  const zLimit = Math.max(0, halfDepth - margin);
  return [
    Math.max(-xLimit, Math.min(xLimit, position[0])),
    position[1],
    Math.max(-zLimit, Math.min(zLimit, position[2])),
  ];
}

export function isPositionInsideOfficeFootprint(
  position: [number, number, number],
  footprint: OfficeFootprint,
  margin = 0,
): boolean {
  const { halfWidth, halfDepth } = getOfficeFootprintHalfExtents(footprint);
  return (
    Math.abs(position[0]) <= Math.max(0, halfWidth - margin) &&
    Math.abs(position[2]) <= Math.max(0, halfDepth - margin)
  );
}

export function expandOfficeFootprint(footprint: OfficeFootprint): OfficeFootprint {
  return {
    width: footprint.width + OFFICE_FOOTPRINT_STEP,
    depth: footprint.depth + OFFICE_FOOTPRINT_STEP,
  };
}

export function shrinkOfficeFootprint(footprint: OfficeFootprint): OfficeFootprint {
  return normalizeOfficeFootprint({
    width: footprint.width - OFFICE_FOOTPRINT_STEP,
    depth: footprint.depth - OFFICE_FOOTPRINT_STEP,
  });
}
