/**
 * OFFICE LAYOUT
 * =============
 * Shared helpers for persisted office floor tiles, derived bounds, and auto-wall generation.
 *
 * KEY CONCEPTS:
 * - Room shape is owned by a paintable tile mask rather than a fixed rectangle.
 * - Existing rectangular offices are normalized into a full tile mask for backward compatibility.
 * - Scene rendering, placement, navigation, and bounds checks should derive from one layout source.
 *
 * USAGE:
 * - Normalize persisted office settings.
 * - Derive room bounds, occupied cells, and wall segments.
 * - Validate or clamp object/team positions against the live floor shape.
 *
 * MEMORY REFERENCES:
 * - MEM-0165
 */

import type { OfficeFootprint } from "@/lib/office-footprint";

export interface OfficeLayoutModel {
  version: 1;
  tileSize: 1;
  tiles: string[];
}

export interface OfficeLayoutBounds {
  minTileX: number;
  maxTileX: number;
  minTileZ: number;
  maxTileZ: number;
  minWorldX: number;
  maxWorldX: number;
  minWorldZ: number;
  maxWorldZ: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
}

export interface OfficeWallSegment {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  width: number;
  depth: number;
}

const TILE_SIZE = 1;

function roundTile(value: number): number {
  return Math.round(value);
}

export function officeLayoutTileKey(x: number, z: number): string {
  return `${roundTile(x)}:${roundTile(z)}`;
}

export function parseOfficeLayoutTileKey(value: string): { x: number; z: number } | null {
  const match = /^(-?\d+):(-?\d+)$/.exec(value.trim());
  if (!match) return null;
  return { x: Number(match[1]), z: Number(match[2]) };
}

function compareTileKeys(a: string, b: string): number {
  const left = parseOfficeLayoutTileKey(a);
  const right = parseOfficeLayoutTileKey(b);
  if (!left || !right) return a.localeCompare(b);
  return left.z === right.z ? left.x - right.x : left.z - right.z;
}

export function createRectangularOfficeLayout(footprint: OfficeFootprint): OfficeLayoutModel {
  const halfWidth = Math.floor(footprint.width / 2);
  const halfDepth = Math.floor(footprint.depth / 2);
  const tiles: string[] = [];
  for (let x = -halfWidth; x <= halfWidth; x += 1) {
    for (let z = -halfDepth; z <= halfDepth; z += 1) {
      tiles.push(officeLayoutTileKey(x, z));
    }
  }
  return {
    version: 1,
    tileSize: TILE_SIZE,
    tiles,
  };
}

export function normalizeOfficeLayout(
  value: unknown,
  fallbackFootprint: OfficeFootprint,
): OfficeLayoutModel {
  if (!value || typeof value !== "object") {
    return createRectangularOfficeLayout(fallbackFootprint);
  }
  const row = value as Record<string, unknown>;
  const rawTiles = Array.isArray(row.tiles) ? row.tiles : [];
  const tileSet = new Set<string>();
  for (const entry of rawTiles) {
    if (typeof entry !== "string") continue;
    const parsed = parseOfficeLayoutTileKey(entry);
    if (!parsed) continue;
    tileSet.add(officeLayoutTileKey(parsed.x, parsed.z));
  }
  if (tileSet.size === 0) {
    return createRectangularOfficeLayout(fallbackFootprint);
  }
  return {
    version: 1,
    tileSize: TILE_SIZE,
    tiles: [...tileSet].sort(compareTileKeys),
  };
}

export function getOfficeLayoutTileSet(layout: OfficeLayoutModel): Set<string> {
  return new Set(layout.tiles);
}

export function getOfficeLayoutBounds(layout: OfficeLayoutModel): OfficeLayoutBounds {
  const parsedTiles = layout.tiles
    .map((tile) => parseOfficeLayoutTileKey(tile))
    .filter((tile): tile is { x: number; z: number } => tile !== null);
  if (parsedTiles.length === 0) {
    const fallback = createRectangularOfficeLayout({ width: 35, depth: 35 });
    return getOfficeLayoutBounds(fallback);
  }
  let minTileX = Number.POSITIVE_INFINITY;
  let maxTileX = Number.NEGATIVE_INFINITY;
  let minTileZ = Number.POSITIVE_INFINITY;
  let maxTileZ = Number.NEGATIVE_INFINITY;
  for (const tile of parsedTiles) {
    minTileX = Math.min(minTileX, tile.x);
    maxTileX = Math.max(maxTileX, tile.x);
    minTileZ = Math.min(minTileZ, tile.z);
    maxTileZ = Math.max(maxTileZ, tile.z);
  }
  const minWorldX = minTileX - TILE_SIZE / 2;
  const maxWorldX = maxTileX + TILE_SIZE / 2;
  const minWorldZ = minTileZ - TILE_SIZE / 2;
  const maxWorldZ = maxTileZ + TILE_SIZE / 2;
  return {
    minTileX,
    maxTileX,
    minTileZ,
    maxTileZ,
    minWorldX,
    maxWorldX,
    minWorldZ,
    maxWorldZ,
    centerX: (minWorldX + maxWorldX) / 2,
    centerZ: (minWorldZ + maxWorldZ) / 2,
    width: maxTileX - minTileX + 1,
    depth: maxTileZ - minTileZ + 1,
  };
}

export function getOfficeFootprintFromLayout(layout: OfficeLayoutModel): OfficeFootprint {
  const bounds = getOfficeLayoutBounds(layout);
  return {
    width: bounds.width,
    depth: bounds.depth,
  };
}

export function hasOfficeLayoutTile(layout: OfficeLayoutModel, x: number, z: number): boolean {
  return getOfficeLayoutTileSet(layout).has(officeLayoutTileKey(x, z));
}

export function isPointInsideOfficeLayout(
  position: [number, number, number],
  layout: OfficeLayoutModel,
): boolean {
  return hasOfficeLayoutTile(layout, position[0], position[2]);
}

export function isPositionInsideOfficeLayout(
  position: [number, number, number],
  layout: OfficeLayoutModel,
  margin = 0,
): boolean {
  const radius = Math.max(0, Math.round(margin));
  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      if (!hasOfficeLayoutTile(layout, position[0] + dx, position[2] + dz)) {
        return false;
      }
    }
  }
  return true;
}

export function clampPositionToOfficeLayout(
  position: [number, number, number],
  layout: OfficeLayoutModel,
  margin = 0,
): [number, number, number] {
  if (isPositionInsideOfficeLayout(position, layout, margin)) return position;
  const candidates = layout.tiles
    .map((tile) => parseOfficeLayoutTileKey(tile))
    .filter((tile): tile is { x: number; z: number } => tile !== null)
    .map((tile) => [tile.x, position[1], tile.z] as [number, number, number])
    .filter((tilePosition) => isPositionInsideOfficeLayout(tilePosition, layout, margin))
    .sort((left, right) => {
      const leftDistance =
        (left[0] - position[0]) ** 2 + (left[2] - position[2]) ** 2;
      const rightDistance =
        (right[0] - position[0]) ** 2 + (right[2] - position[2]) ** 2;
      return leftDistance - rightDistance;
    });
  return candidates[0] ?? position;
}

export function getManagementAnchorFromOfficeLayout(
  layout: OfficeLayoutModel,
): [number, number, number] {
  const rough = getPreferredManagementAnchorFromOfficeLayout(layout);
  return clampPositionToOfficeLayout(rough, layout, 0);
}

export function getPreferredManagementAnchorFromOfficeLayout(
  layout: OfficeLayoutModel,
): [number, number, number] {
  const bounds = getOfficeLayoutBounds(layout);
  const frontZ = bounds.maxTileZ - 4;
  return [Math.round(bounds.centerX), 0, frontZ];
}

export function getOfficeLayoutEditBounds(layout: OfficeLayoutModel, padding = 6): {
  width: number;
  depth: number;
  centerX: number;
  centerZ: number;
} {
  const bounds = getOfficeLayoutBounds(layout);
  return {
    width: bounds.width + padding * 2,
    depth: bounds.depth + padding * 2,
    centerX: bounds.centerX,
    centerZ: bounds.centerZ,
  };
}

export function applyOfficeLayoutPaint(
  layout: OfficeLayoutModel,
  cells: Iterable<string>,
  mode: "add" | "remove",
): OfficeLayoutModel {
  const tileSet = getOfficeLayoutTileSet(layout);
  for (const cell of cells) {
    const parsed = parseOfficeLayoutTileKey(cell);
    if (!parsed) continue;
    const normalized = officeLayoutTileKey(parsed.x, parsed.z);
    if (mode === "add") {
      tileSet.add(normalized);
    } else {
      tileSet.delete(normalized);
    }
  }
  if (tileSet.size === 0) {
    return layout;
  }
  return {
    ...layout,
    tiles: [...tileSet].sort(compareTileKeys),
  };
}

export function fillEnclosedOfficeLayoutGaps(layout: OfficeLayoutModel): OfficeLayoutModel {
  const tileSet = getOfficeLayoutTileSet(layout);
  const bounds = getOfficeLayoutBounds(layout);
  const visited = new Set<string>();
  const queue: Array<{ x: number; z: number }> = [];
  const minX = bounds.minTileX - 1;
  const maxX = bounds.maxTileX + 1;
  const minZ = bounds.minTileZ - 1;
  const maxZ = bounds.maxTileZ + 1;

  const push = (x: number, z: number): void => {
    if (x < minX || x > maxX || z < minZ || z > maxZ) return;
    const key = officeLayoutTileKey(x, z);
    if (tileSet.has(key) || visited.has(key)) return;
    visited.add(key);
    queue.push({ x, z });
  };

  for (let x = minX; x <= maxX; x += 1) {
    push(x, minZ);
    push(x, maxZ);
  }
  for (let z = minZ; z <= maxZ; z += 1) {
    push(minX, z);
    push(maxX, z);
  }

  while (queue.length > 0) {
    const next = queue.shift()!;
    push(next.x + 1, next.z);
    push(next.x - 1, next.z);
    push(next.x, next.z + 1);
    push(next.x, next.z - 1);
  }

  const filled = new Set(tileSet);
  for (let x = bounds.minTileX; x <= bounds.maxTileX; x += 1) {
    for (let z = bounds.minTileZ; z <= bounds.maxTileZ; z += 1) {
      const key = officeLayoutTileKey(x, z);
      if (filled.has(key)) continue;
      if (visited.has(key)) continue;
      filled.add(key);
    }
  }

  if (filled.size === tileSet.size) return layout;
  return {
    ...layout,
    tiles: [...filled].sort(compareTileKeys),
  };
}

export function expandOfficeLayoutRemovalStroke(
  layout: OfficeLayoutModel,
  strokeCells: Iterable<string>,
): Set<string> {
  const occupied = getOfficeLayoutTileSet(layout);
  const boundary = new Set<string>();
  const parsedStroke = [...strokeCells]
    .map((cell) => parseOfficeLayoutTileKey(cell))
    .filter((cell): cell is { x: number; z: number } => cell !== null)
    .filter((cell) => occupied.has(officeLayoutTileKey(cell.x, cell.z)));
  for (const cell of parsedStroke) {
    boundary.add(officeLayoutTileKey(cell.x, cell.z));
  }
  if (boundary.size === 0) return boundary;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const cell of parsedStroke) {
    minX = Math.min(minX, cell.x);
    maxX = Math.max(maxX, cell.x);
    minZ = Math.min(minZ, cell.z);
    maxZ = Math.max(maxZ, cell.z);
  }
  minX -= 1;
  maxX += 1;
  minZ -= 1;
  maxZ += 1;

  const visited = new Set<string>();
  const queue: Array<{ x: number; z: number }> = [];
  const push = (x: number, z: number): void => {
    if (x < minX || x > maxX || z < minZ || z > maxZ) return;
    const key = officeLayoutTileKey(x, z);
    if (visited.has(key) || boundary.has(key) || !occupied.has(key)) return;
    visited.add(key);
    queue.push({ x, z });
  };

  for (let x = minX; x <= maxX; x += 1) {
    push(x, minZ);
    push(x, maxZ);
  }
  for (let z = minZ; z <= maxZ; z += 1) {
    push(minX, z);
    push(maxX, z);
  }

  while (queue.length > 0) {
    const next = queue.shift()!;
    push(next.x + 1, next.z);
    push(next.x - 1, next.z);
    push(next.x, next.z + 1);
    push(next.x, next.z - 1);
  }

  const expanded = new Set(boundary);
  for (let x = minX + 1; x <= maxX - 1; x += 1) {
    for (let z = minZ + 1; z <= maxZ - 1; z += 1) {
      const key = officeLayoutTileKey(x, z);
      if (!occupied.has(key)) continue;
      if (boundary.has(key)) continue;
      if (visited.has(key)) continue;
      expanded.add(key);
    }
  }
  return expanded;
}

export function getOfficeLayoutWallSegments(layout: OfficeLayoutModel): OfficeWallSegment[] {
  const tileSet = getOfficeLayoutTileSet(layout);
  const segments: OfficeWallSegment[] = [];
  const wallThickness = 0.18;
  const inset = wallThickness / 2;
  for (const tileKey of tileSet) {
    const tile = parseOfficeLayoutTileKey(tileKey);
    if (!tile) continue;
    const neighbors = [
      {
        key: officeLayoutTileKey(tile.x, tile.z - 1),
        id: `${tileKey}:north`,
        position: [tile.x, 1.5, tile.z - 0.5 + inset] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        width: 1,
        depth: wallThickness,
      },
      {
        key: officeLayoutTileKey(tile.x, tile.z + 1),
        id: `${tileKey}:south`,
        position: [tile.x, 1.5, tile.z + 0.5 - inset] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        width: 1,
        depth: wallThickness,
      },
      {
        key: officeLayoutTileKey(tile.x - 1, tile.z),
        id: `${tileKey}:west`,
        position: [tile.x - 0.5 + inset, 1.5, tile.z] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        width: wallThickness,
        depth: 1,
      },
      {
        key: officeLayoutTileKey(tile.x + 1, tile.z),
        id: `${tileKey}:east`,
        position: [tile.x + 0.5 - inset, 1.5, tile.z] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        width: wallThickness,
        depth: 1,
      },
    ];
    for (const neighbor of neighbors) {
      if (tileSet.has(neighbor.key)) continue;
      segments.push(neighbor);
    }
  }
  return segments;
}
