/**
 * CLUSTER LAYOUT ENGINE
 * =====================
 * Policy-driven cluster layout solver reusable across mesh types.
 *
 * KEY CONCEPTS:
 * - Mesh footprint metadata drives spacing and placement.
 * - Topology solver creates slots; transform/orientation solvers resolve poses.
 * - Odd-count tail strategy defaults to centroid-facing side placement.
 *
 * USAGE:
 * - Use `solveClusterLayout()` for generic cluster meshes.
 * - Use compatibility adapters (`getDeskPosition`, `getDeskRotation`) for desk code.
 */
import { DESK_DEPTH, DESK_WIDTH, EMPLOYEE_RADIUS } from "../../constants";

export type LayoutOddStrategy = "tail-centroid";
export type LayoutAnchorMode = "centroid" | "frontWeighted";

export interface MeshFootprint {
  width: number;
  depth: number;
  clearanceX: number;
  clearanceZ: number;
  pivot?: [number, number];
}

export interface LayoutPolicy {
  oddStrategy: LayoutOddStrategy;
  anchorMode: LayoutAnchorMode;
  tailOffsetColumns: number;
}

type SlotRole = "grid" | "tail";
type SlotRow = 0 | 1 | 0.5;

interface LayoutSlot {
  slotId: string;
  row: SlotRow;
  col: number;
  role: SlotRole;
}

interface LayoutTransform {
  slotId: string;
  x: number;
  z: number;
  yaw: number;
  role: SlotRole;
}

export interface LayoutSolveResult {
  footprint: MeshFootprint;
  slots: Array<{ slotId: string; row: SlotRow; col: number; role: SlotRole }>;
  transforms: Array<{ slotId: string; x: number; z: number; yaw: number; role: SlotRole }>;
  anchor: { x: number; z: number };
  policy: LayoutPolicy;
}

const DESK_FOOTPRINT: MeshFootprint = {
  width: DESK_WIDTH,
  depth: DESK_DEPTH,
  clearanceX: 0.2,
  clearanceZ: 0.35,
  pivot: [0, 0],
};

const DEFAULT_LAYOUT_POLICY: LayoutPolicy = {
  oddStrategy: "tail-centroid",
  anchorMode: "centroid",
  // Keep odd-count tail a bit closer than one full column gap.
  tailOffsetColumns: 0.75,
};

function clampCount(count: number): number {
  if (!Number.isFinite(count)) return 1;
  return Math.max(1, Math.floor(count));
}

function solveTopology(count: number, policy: LayoutPolicy): LayoutSlot[] {
  const safeCount = clampCount(count);
  if (safeCount === 1) {
    return [{ slotId: "slot-0", row: 0.5, col: 0, role: "grid" }];
  }

  const hasOddTail = safeCount > 1 && safeCount % 2 === 1;
  const pairCount = hasOddTail ? safeCount - 1 : safeCount;
  const pairCols = Math.max(1, Math.ceil(pairCount / 2));
  const slots: LayoutSlot[] = [];
  let slotIndex = 0;

  for (let col = 0; col < pairCols; col += 1) {
    slots.push({ slotId: `slot-${slotIndex}`, row: 0, col, role: "grid" });
    slotIndex += 1;
    if (slots.length >= pairCount) break;
    slots.push({ slotId: `slot-${slotIndex}`, row: 1, col, role: "grid" });
    slotIndex += 1;
  }

  if (hasOddTail && policy.oddStrategy === "tail-centroid") {
    slots.push({
      slotId: `slot-${slotIndex}`,
      row: 0.5,
      col: pairCols - 1 + policy.tailOffsetColumns,
      role: "tail",
    });
  }

  return slots;
}

function getRawPosition(slot: LayoutSlot, footprint: MeshFootprint): [number, number] {
  const spacingX = footprint.width + footprint.clearanceX;
  const spacingZ = footprint.depth + footprint.clearanceZ;
  const x = slot.col * spacingX;
  const z = slot.row === 0 ? -spacingZ / 2 : slot.row === 1 ? spacingZ / 2 : 0;
  return [x, z];
}

function centerTransforms(
  slots: LayoutSlot[],
  footprint: MeshFootprint,
): Array<{ slot: LayoutSlot; x: number; z: number }> {
  const raw = slots.map((slot) => {
    const [x, z] = getRawPosition(slot, footprint);
    return { slot, x, z };
  });
  const minX = Math.min(...raw.map((row) => row.x));
  const maxX = Math.max(...raw.map((row) => row.x));
  const offsetX = (minX + maxX) / 2;
  return raw.map((row) => ({ slot: row.slot, x: row.x - offsetX, z: row.z }));
}

function applyOrientation(
  centered: Array<{ slot: LayoutSlot; x: number; z: number }>,
): LayoutTransform[] {
  const transforms: LayoutTransform[] = centered.map((row) => ({
    slotId: row.slot.slotId,
    x: row.x,
    z: row.z,
    yaw: row.slot.row === 0 ? Math.PI : 0,
    role: row.slot.role,
  }));

  const tail = transforms.find((row) => row.role === "tail");
  if (!tail) return transforms;

  const centroid = computeAnchor(transforms, "centroid");
  const toCentroidX = centroid.x - tail.x;
  const toCentroidZ = centroid.z - tail.z;
  // Desk monitor is on local -Z; yaw points monitor toward centroid.
  tail.yaw = Math.atan2(-toCentroidX, -toCentroidZ);
  return transforms;
}

function computeAnchor(
  transforms: Array<{ x: number; z: number }>,
  mode: LayoutAnchorMode,
): { x: number; z: number } {
  if (transforms.length === 0) return { x: 0, z: 0 };
  if (mode === "frontWeighted") {
    const front = transforms.filter((row) => row.z <= 0);
    const source = front.length > 0 ? front : transforms;
    return {
      x: source.reduce((sum, row) => sum + row.x, 0) / source.length,
      z: source.reduce((sum, row) => sum + row.z, 0) / source.length,
    };
  }
  return {
    x: transforms.reduce((sum, row) => sum + row.x, 0) / transforms.length,
    z: transforms.reduce((sum, row) => sum + row.z, 0) / transforms.length,
  };
}

export function solveClusterLayout(
  count: number,
  footprint: MeshFootprint,
  policy: LayoutPolicy = DEFAULT_LAYOUT_POLICY,
): LayoutSolveResult {
  const slots = solveTopology(count, policy);
  const centered = centerTransforms(slots, footprint);
  const transforms = applyOrientation(centered);
  const anchor = computeAnchor(transforms, policy.anchorMode);
  return {
    footprint,
    slots,
    transforms,
    anchor,
    policy,
  };
}

export function getClusterAnchor(
  count: number,
  footprint: MeshFootprint = DESK_FOOTPRINT,
  policy: LayoutPolicy = DEFAULT_LAYOUT_POLICY,
): [number, number, number] {
  const solved = solveClusterLayout(count, footprint, policy);
  return [solved.anchor.x, 0, solved.anchor.z];
}

export function getDeskPosition(
  clusterPosition: [number, number, number],
  deskIndex: number,
  totalDesks: number,
): [number, number, number] {
  void clusterPosition;
  const safeTotal = clampCount(totalDesks);
  const safeIndex = Math.max(0, Math.min(Math.floor(deskIndex), safeTotal - 1));
  const solved = solveClusterLayout(safeTotal, DESK_FOOTPRINT, DEFAULT_LAYOUT_POLICY);
  const transform = solved.transforms[safeIndex];
  return [transform.x, 0, transform.z];
}

export function getDeskRotation(deskIndex: number, totalDesks: number): number {
  const safeTotal = clampCount(totalDesks);
  const safeIndex = Math.max(0, Math.min(Math.floor(deskIndex), safeTotal - 1));
  const solved = solveClusterLayout(safeTotal, DESK_FOOTPRINT, DEFAULT_LAYOUT_POLICY);
  return solved.transforms[safeIndex].yaw;
}

export function getAbsoluteDeskPosition(
  clusterPosition: [number, number, number],
  deskIndex: number,
  totalDesks: number,
): [number, number, number] {
  const relativePosition = getDeskPosition(clusterPosition, deskIndex, totalDesks);
  return [
    clusterPosition[0] + relativePosition[0],
    clusterPosition[1] + relativePosition[1],
    clusterPosition[2] + relativePosition[2],
  ];
}

export function getEmployeePositionAtDesk(
  deskPosition: [number, number, number],
  deskRotation: number,
): [number, number, number] {
  const offset = DESK_DEPTH / 2 + EMPLOYEE_RADIUS + 0.5;
  const forwardX = Math.sin(deskRotation);
  const forwardZ = Math.cos(deskRotation);
  return [
    deskPosition[0] + forwardX * offset,
    0,
    deskPosition[2] + forwardZ * offset,
  ];
}
