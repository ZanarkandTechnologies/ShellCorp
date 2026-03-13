/**
 * OFFICE SETTINGS BRIDGE
 * ======================
 * Normalization shared by the Vite state bridge for office settings persistence.
 *
 * KEY CONCEPTS:
 * - Bridge writes must preserve the tile-backed office layout instead of collapsing to bounds.
 * - `officeFootprint` remains a derived compatibility box from the saved layout.
 *
 * USAGE:
 * - Import from `vite.config.ts` when reading or writing `/openclaw/office-settings`.
 *
 * MEMORY REFERENCES:
 * - MEM-0172
 * - MEM-0173
 */

import path from "node:path";

export interface BridgeOfficeSettings {
  meshAssetDir?: string;
  officeFootprint?: {
    width?: number;
    depth?: number;
  };
  officeLayout?: {
    version?: number;
    tileSize?: number;
    tiles?: string[];
  };
  decor?: {
    floorPatternId?: "sandstone_tiles" | "graphite_grid" | "walnut_parquet";
    wallColorId?: "gallery_cream" | "sage_mist" | "harbor_blue" | "clay_rose";
    backgroundId?: "shell_haze" | "midnight_tide" | "kelp_fog" | "estuary_glow";
  };
  viewProfile?: "free_orbit_3d" | "fixed_2_5d";
  orbitControlsEnabled?: boolean;
  cameraOrientation?: "north_east" | "north_west" | "south_east" | "south_west";
}

type JsonObject = Record<string, unknown>;

function normalizeAxis(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  const bounded = Math.max(15, rounded);
  return bounded % 2 === 0 ? bounded + 1 : bounded;
}

function officeLayoutTileKey(x: number, z: number): string {
  return `${Math.round(x)}:${Math.round(z)}`;
}

function parseOfficeLayoutTileKey(value: string): { x: number; z: number } | null {
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

function createRectangularOfficeLayout(footprint: { width: number; depth: number }): string[] {
  const halfWidth = Math.floor(footprint.width / 2);
  const halfDepth = Math.floor(footprint.depth / 2);
  const tiles: string[] = [];
  for (let x = -halfWidth; x <= halfWidth; x += 1) {
    for (let z = -halfDepth; z <= halfDepth; z += 1) {
      tiles.push(officeLayoutTileKey(x, z));
    }
  }
  return tiles;
}

function normalizeOfficeLayout(
  value: unknown,
  fallbackFootprint: { width: number; depth: number },
): { version: 1; tileSize: 1; tiles: string[] } {
  if (!value || typeof value !== "object") {
    return {
      version: 1,
      tileSize: 1,
      tiles: createRectangularOfficeLayout(fallbackFootprint),
    };
  }
  const row = value as JsonObject;
  const rawTiles = Array.isArray(row.tiles) ? row.tiles : [];
  const tileSet = new Set<string>();
  for (const entry of rawTiles) {
    if (typeof entry !== "string") continue;
    const parsed = parseOfficeLayoutTileKey(entry);
    if (!parsed) continue;
    tileSet.add(officeLayoutTileKey(parsed.x, parsed.z));
  }
  if (tileSet.size === 0) {
    return {
      version: 1,
      tileSize: 1,
      tiles: createRectangularOfficeLayout(fallbackFootprint),
    };
  }
  return {
    version: 1,
    tileSize: 1,
    tiles: [...tileSet].sort(compareTileKeys),
  };
}

function deriveOfficeFootprintFromLayout(layout: { tiles: string[] }): { width: number; depth: number } {
  const parsed = layout.tiles
    .map((tile) => parseOfficeLayoutTileKey(tile))
    .filter((tile): tile is { x: number; z: number } => tile !== null);
  if (parsed.length === 0) {
    return { width: 35, depth: 35 };
  }
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const tile of parsed) {
    minX = Math.min(minX, tile.x);
    maxX = Math.max(maxX, tile.x);
    minZ = Math.min(minZ, tile.z);
    maxZ = Math.max(maxZ, tile.z);
  }
  return {
    width: maxX - minX + 1,
    depth: maxZ - minZ + 1,
  };
}

export function normalizeBridgeOfficeSettings(
  input: unknown,
  defaultMeshAssetDir: string,
): Required<BridgeOfficeSettings> {
  const row = input && typeof input === "object" ? (input as JsonObject) : {};
  const meshAssetDir =
    typeof row.meshAssetDir === "string" && row.meshAssetDir.trim()
      ? path.resolve(row.meshAssetDir.trim())
      : defaultMeshAssetDir;
  const rawFootprint =
    row.officeFootprint && typeof row.officeFootprint === "object"
      ? (row.officeFootprint as JsonObject)
      : {};
  const fallbackFootprint = {
    width: normalizeAxis(rawFootprint.width, 35),
    depth: normalizeAxis(rawFootprint.depth, 35),
  };
  const rawDecor = row.decor && typeof row.decor === "object" ? (row.decor as JsonObject) : {};
  const viewProfile = row.viewProfile === "fixed_2_5d" ? "fixed_2_5d" : "free_orbit_3d";
  const officeLayout = normalizeOfficeLayout(row.officeLayout, fallbackFootprint);

  return {
    meshAssetDir,
    officeFootprint: deriveOfficeFootprintFromLayout(officeLayout),
    officeLayout,
    decor: {
      floorPatternId:
        rawDecor.floorPatternId === "graphite_grid" || rawDecor.floorPatternId === "walnut_parquet"
          ? rawDecor.floorPatternId
          : "sandstone_tiles",
      wallColorId:
        rawDecor.wallColorId === "sage_mist" ||
        rawDecor.wallColorId === "harbor_blue" ||
        rawDecor.wallColorId === "clay_rose"
          ? rawDecor.wallColorId
          : "gallery_cream",
      backgroundId:
        rawDecor.backgroundId === "midnight_tide" ||
        rawDecor.backgroundId === "kelp_fog" ||
        rawDecor.backgroundId === "estuary_glow"
          ? rawDecor.backgroundId
          : "shell_haze",
    },
    viewProfile,
    orbitControlsEnabled: row.orbitControlsEnabled !== false,
    cameraOrientation:
      row.cameraOrientation === "north_east" ||
      row.cameraOrientation === "north_west" ||
      row.cameraOrientation === "south_west"
        ? row.cameraOrientation
        : "south_east",
  };
}
