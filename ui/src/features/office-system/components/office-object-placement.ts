/**
 * OFFICE OBJECT PLACEMENT
 * =======================
 * Shared builder placement helpers for draggable office objects.
 *
 * KEY CONCEPTS:
 * - Builder drag and exact transform saves must use the same office-layout placement rules.
 * - Object placement snaps to integer tile centers before layout clamping so preview matches persisted tile coordinates.
 *
 * USAGE:
 * - `getOfficeObjectPlacementMargin(meshType)`
 * - `constrainOfficeObjectPositionForLayout(position, layout, meshType)`
 *
 * MEMORY REFERENCES:
 * - MEM-0186
 */

import { clampPositionToOfficeLayout, type OfficeLayoutModel } from "../../../lib/office-layout";

export function getOfficeObjectPlacementMargin(meshType: string): number {
  return meshType === "team-cluster" ? 2 : 1;
}

export function constrainOfficeObjectPositionForLayout(
  position: [number, number, number],
  layout: OfficeLayoutModel,
  meshType: string,
): [number, number, number] {
  const snapped: [number, number, number] = [
    Math.round(position[0]),
    position[1],
    Math.round(position[2]),
  ];
  return clampPositionToOfficeLayout(snapped, layout, getOfficeObjectPlacementMargin(meshType));
}
