/**
 * OFFICE DECOR
 * ============
 * Shared preset contracts for office floor patterns, wall colors, and fixed wall-art slots.
 *
 * KEY CONCEPTS:
 * - Decor stays settings-backed and uses a small curated preset list for MVP reliability.
 * - Wall art anchors by slot id so room resizing keeps paintings attached to the room shell.
 *
 * USAGE:
 * - Normalize persisted office decor settings.
 * - Render room materials and fixed wall-art slots in the office scene.
 * - Populate Office Shop decor controls.
 *
 * MEMORY REFERENCES:
 * - MEM-0169
 */

import { WALL_HEIGHT, WALL_THICKNESS } from "../constants";
import { getOfficeFootprintHalfExtents, type OfficeFootprint } from "./office-footprint";

export type OfficeFloorPatternId = "sandstone_tiles" | "graphite_grid" | "walnut_parquet";
export type OfficeWallColorId = "gallery_cream" | "sage_mist" | "harbor_blue" | "clay_rose";
export type OfficeBackgroundId =
  | "shell_haze"
  | "midnight_tide"
  | "kelp_fog"
  | "estuary_glow";
export type OfficePaintingPresetId = "sunrise_blocks" | "night_geometry" | "studio_lines";
export type WallArtSlotId = "back-left" | "back-center" | "back-right" | "left-center";

export interface OfficeDecorSettings {
  floorPatternId: OfficeFloorPatternId;
  wallColorId: OfficeWallColorId;
  backgroundId: OfficeBackgroundId;
}

export interface OfficeDecorPack {
  id: string;
  label: string;
  description: string;
  floorPatternId: OfficeFloorPatternId;
  wallColorId: OfficeWallColorId;
  backgroundId: OfficeBackgroundId;
  preview: string;
}

export interface OfficeFloorPatternPreset {
  id: OfficeFloorPatternId;
  label: string;
  description: string;
  swatch: string;
  colors: [string, string, string];
}

export interface OfficeWallColorPreset {
  id: OfficeWallColorId;
  label: string;
  description: string;
  color: string;
}

export interface OfficeBackgroundPreset {
  id: OfficeBackgroundId;
  label: string;
  description: string;
  lightColor: string;
  darkColor: string;
  swatch: string;
}

export interface OfficePaintingPreset {
  id: OfficePaintingPresetId;
  label: string;
  description: string;
  frameColor: string;
  colors: [string, string, string];
}

export interface WallArtSlot {
  id: WallArtSlotId;
  label: string;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
}

export const DEFAULT_OFFICE_DECOR: OfficeDecorSettings = {
  floorPatternId: "sandstone_tiles",
  wallColorId: "gallery_cream",
  backgroundId: "shell_haze",
};

export const OFFICE_FLOOR_PATTERN_PRESETS: readonly OfficeFloorPatternPreset[] = [
  {
    id: "sandstone_tiles",
    label: "Sandstone Tiles",
    description: "Warm square tiles with subtle grout lines.",
    swatch:
      "linear-gradient(135deg, #d7c4a5 0%, #d7c4a5 48%, #efe2cc 48%, #efe2cc 52%, #c2b092 52%, #c2b092 100%)",
    colors: ["#d7c4a5", "#efe2cc", "#c2b092"],
  },
  {
    id: "graphite_grid",
    label: "Graphite Grid",
    description: "Cool stone grid for a more technical office look.",
    swatch:
      "linear-gradient(135deg, #51606c 0%, #51606c 47%, #a9b6bf 47%, #a9b6bf 53%, #3d4953 53%, #3d4953 100%)",
    colors: ["#51606c", "#a9b6bf", "#3d4953"],
  },
  {
    id: "walnut_parquet",
    label: "Walnut Parquet",
    description: "Simple parquet-inspired wood pattern.",
    swatch: "linear-gradient(90deg, #8a5a3a 0%, #8a5a3a 50%, #6e452d 50%, #6e452d 100%)",
    colors: ["#8a5a3a", "#c68e5b", "#6e452d"],
  },
] as const;

export const OFFICE_WALL_COLOR_PRESETS: readonly OfficeWallColorPreset[] = [
  {
    id: "gallery_cream",
    label: "Gallery Cream",
    description: "Soft neutral white for brighter rooms.",
    color: "#ede5d6",
  },
  {
    id: "sage_mist",
    label: "Sage Mist",
    description: "Muted green with a calm studio feel.",
    color: "#cbd4c3",
  },
  {
    id: "harbor_blue",
    label: "Harbor Blue",
    description: "Dusty blue-grey for a quieter backdrop.",
    color: "#bcc8d6",
  },
  {
    id: "clay_rose",
    label: "Clay Rose",
    description: "Warm blush neutral for a cozier office.",
    color: "#dbc4bb",
  },
] as const;

export const OFFICE_BACKGROUND_PRESETS: readonly OfficeBackgroundPreset[] = [
  {
    id: "shell_haze",
    label: "Shell Haze",
    description: "A warm shell-toned horizon that stays soft in both light and dark mode.",
    lightColor: "#e8dcc4",
    darkColor: "#1a1612",
    swatch: "linear-gradient(135deg, #e8dcc4 0%, #d8c5a3 55%, #1a1612 100%)",
  },
  {
    id: "midnight_tide",
    label: "Midnight Tide",
    description: "Cool harbor air for the darker clam-cabinet and control-room themes.",
    lightColor: "#d8e2ea",
    darkColor: "#101923",
    swatch: "linear-gradient(135deg, #d8e2ea 0%, #7d93a8 55%, #101923 100%)",
  },
  {
    id: "kelp_fog",
    label: "Kelp Fog",
    description: "Muted environmental backdrop with a mossy low-contrast void.",
    lightColor: "#dde5d9",
    darkColor: "#121814",
    swatch: "linear-gradient(135deg, #dde5d9 0%, #8c9b87 55%, #121814 100%)",
  },
  {
    id: "estuary_glow",
    label: "Estuary Glow",
    description: "A warmer atmospheric backdrop with dusk-toned depth.",
    lightColor: "#ecd4c4",
    darkColor: "#221511",
    swatch: "linear-gradient(135deg, #ecd4c4 0%, #cf9f87 55%, #221511 100%)",
  },
] as const;

export const OFFICE_PAINTING_PRESETS: readonly OfficePaintingPreset[] = [
  {
    id: "sunrise_blocks",
    label: "Sunrise Blocks",
    description: "Layered warm blocks with a soft sunrise accent.",
    frameColor: "#5b4636",
    colors: ["#ee9b6d", "#f7d08a", "#7e9cb8"],
  },
  {
    id: "night_geometry",
    label: "Night Geometry",
    description: "Dark geometric shapes with brass contrast.",
    frameColor: "#2d2b34",
    colors: ["#1e2530", "#6b7c93", "#d3aa63"],
  },
  {
    id: "studio_lines",
    label: "Studio Lines",
    description: "Minimal graphic lines in a neutral studio palette.",
    frameColor: "#4a4138",
    colors: ["#f1e8dc", "#c9704c", "#425163"],
  },
] as const;

export const OFFICE_DECOR_PACKS: readonly OfficeDecorPack[] = [
  {
    id: "shell-parlor",
    label: "Shell Parlor",
    description: "Soft shell walls with warm stone flooring. Calm and slightly coastal.",
    floorPatternId: "sandstone_tiles",
    wallColorId: "gallery_cream",
    backgroundId: "shell_haze",
    preview:
      "linear-gradient(180deg, #ede5d6 0%, #ede5d6 58%, #d7c4a5 58%, #efe2cc 82%, #c2b092 100%)",
  },
  {
    id: "clam-cabinet",
    label: "Clam Cabinet",
    description: "Blue-grey walls with graphite flooring for a cool crustacean control room.",
    floorPatternId: "graphite_grid",
    wallColorId: "harbor_blue",
    backgroundId: "midnight_tide",
    preview:
      "linear-gradient(180deg, #bcc8d6 0%, #bcc8d6 58%, #51606c 58%, #a9b6bf 82%, #3d4953 100%)",
  },
  {
    id: "underclaw-burrow",
    label: "Underclaw Burrow",
    description: "Muted sage walls with walnut floor tones for an underground den feel.",
    floorPatternId: "walnut_parquet",
    wallColorId: "sage_mist",
    backgroundId: "kelp_fog",
    preview:
      "linear-gradient(180deg, #cbd4c3 0%, #cbd4c3 58%, #8a5a3a 58%, #c68e5b 82%, #6e452d 100%)",
  },
  {
    id: "estuary-sunset",
    label: "Estuary Sunset",
    description: "Clay walls with warm tile flooring for a softer environmental room.",
    floorPatternId: "sandstone_tiles",
    wallColorId: "clay_rose",
    backgroundId: "estuary_glow",
    preview:
      "linear-gradient(180deg, #dbc4bb 0%, #dbc4bb 58%, #d7c4a5 58%, #efe2cc 82%, #c2b092 100%)",
  },
] as const;

export function normalizeOfficeDecorSettings(input: unknown): OfficeDecorSettings {
  const row = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const floorPatternId = row.floorPatternId;
  const wallColorId = row.wallColorId;
  const backgroundId = row.backgroundId;

  return {
    floorPatternId: OFFICE_FLOOR_PATTERN_PRESETS.some((preset) => preset.id === floorPatternId)
      ? (floorPatternId as OfficeFloorPatternId)
      : DEFAULT_OFFICE_DECOR.floorPatternId,
    wallColorId: OFFICE_WALL_COLOR_PRESETS.some((preset) => preset.id === wallColorId)
      ? (wallColorId as OfficeWallColorId)
      : DEFAULT_OFFICE_DECOR.wallColorId,
    backgroundId: OFFICE_BACKGROUND_PRESETS.some((preset) => preset.id === backgroundId)
      ? (backgroundId as OfficeBackgroundId)
      : DEFAULT_OFFICE_DECOR.backgroundId,
  };
}

export function getFloorPatternPreset(patternId: OfficeFloorPatternId): OfficeFloorPatternPreset {
  return (
    OFFICE_FLOOR_PATTERN_PRESETS.find((preset) => preset.id === patternId) ??
    OFFICE_FLOOR_PATTERN_PRESETS[0]
  );
}

export function getWallColorPreset(wallColorId: OfficeWallColorId): OfficeWallColorPreset {
  return (
    OFFICE_WALL_COLOR_PRESETS.find((preset) => preset.id === wallColorId) ??
    OFFICE_WALL_COLOR_PRESETS[0]
  );
}

export function getBackgroundPreset(backgroundId: OfficeBackgroundId): OfficeBackgroundPreset {
  return (
    OFFICE_BACKGROUND_PRESETS.find((preset) => preset.id === backgroundId) ??
    OFFICE_BACKGROUND_PRESETS[0]
  );
}

export function getPaintingPreset(paintingPresetId: OfficePaintingPresetId): OfficePaintingPreset {
  return (
    OFFICE_PAINTING_PRESETS.find((preset) => preset.id === paintingPresetId) ??
    OFFICE_PAINTING_PRESETS[0]
  );
}

export function getWallArtSlots(officeFootprint: OfficeFootprint): readonly WallArtSlot[] {
  const { halfWidth, halfDepth } = getOfficeFootprintHalfExtents(officeFootprint);
  const artY = Math.min(3.2, WALL_HEIGHT - 1.1);
  const inset = WALL_THICKNESS + 0.08;

  return [
    {
      id: "back-left",
      label: "Back Left",
      position: [-Math.max(4, halfWidth * 0.45), artY, -halfDepth + inset],
      rotation: [0, 0, 0],
      size: [2.6, 1.8],
    },
    {
      id: "back-center",
      label: "Back Center",
      position: [0, artY, -halfDepth + inset],
      rotation: [0, 0, 0],
      size: [2.8, 1.9],
    },
    {
      id: "back-right",
      label: "Back Right",
      position: [Math.max(4, halfWidth * 0.45), artY, -halfDepth + inset],
      rotation: [0, 0, 0],
      size: [2.6, 1.8],
    },
    {
      id: "left-center",
      label: "Left Wall",
      position: [-halfWidth + inset, artY, 0],
      rotation: [0, Math.PI / 2, 0],
      size: [2.4, 1.7],
    },
  ] as const;
}
