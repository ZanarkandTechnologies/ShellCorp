/**
 * OFFICE ROOM SHELL
 * =================
 * Tile-based floor and auto-wall geometry for the office container.
 *
 * KEY CONCEPTS:
 * - Room chrome is presentation-only and derives from the persisted office layout mask.
 * - Builder mode should favor readability over decoration, so the floor pattern is intentionally muted while editing.
 *
 * USAGE:
 * - Render inside `SceneContents` and pass the floor ref plus background click handler.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 * - MEM-0165
 */

import { useMemo } from "react";
import { Box } from "@react-three/drei";
import * as THREE from "three";
import { WALL_HEIGHT } from "@/constants";
import type { getOfficeTheme } from "@/config/office-theme";
import type { ThreeEvent } from "@react-three/fiber";
import { getFloorPatternPreset, getWallColorPreset } from "@/lib/office-decor";
import {
  getOfficeLayoutBounds,
  getOfficeLayoutTileSet,
  getOfficeLayoutWallSegments,
  parseOfficeLayoutTileKey,
  type OfficeLayoutModel,
} from "@/lib/office-layout";
import type { OfficeFootprint } from "@/lib/office-footprint";
import type { OfficeSettingsModel } from "@/lib/openclaw-types";
import type { OfficeSceneViewSettings } from "./view-profile";

/** In fixed 2.5D, the two "front" walls (facing camera) get zoom-based opacity; others stay full. */
function getFrontWallsForOpacity(settings: OfficeSceneViewSettings): {
  frontNorth: boolean;
  frontSouth: boolean;
  frontWest: boolean;
  frontEast: boolean;
} {
  if (settings.viewProfile !== "fixed_2_5d") {
    return { frontNorth: false, frontSouth: false, frontWest: false, frontEast: false };
  }
  switch (settings.cameraOrientation) {
    case "south_west":
      return { frontNorth: false, frontSouth: true, frontWest: true, frontEast: false };
    case "north_east":
      return { frontNorth: true, frontSouth: false, frontWest: false, frontEast: true };
    case "north_west":
      return { frontNorth: true, frontSouth: false, frontWest: true, frontEast: false };
    case "south_east":
    default:
      return { frontNorth: false, frontSouth: true, frontWest: false, frontEast: true };
  }
}

function resolveFloorTileColor(
  patternId: OfficeSettingsModel["decor"]["floorPatternId"],
  x: number,
  z: number,
  sceneBuilderMode: boolean,
): string {
  if (sceneBuilderMode) return "#d9ddd8";
  const preset = getFloorPatternPreset(patternId);
  const [base, accent, line] = preset.colors;
  if (patternId === "sandstone_tiles") {
    return (x + z) % 2 === 0 ? accent : base;
  }
  if (patternId === "graphite_grid") {
    return x % 3 === 0 || z % 3 === 0 ? line : accent;
  }
  return z % 2 === 0 ? accent : base;
}

export function OfficeRoomShell(props: {
  floorRef: React.RefObject<THREE.Mesh | null>;
  officeFootprint: OfficeFootprint;
  officeLayout: OfficeLayoutModel;
  officeDecorSettings: OfficeSettingsModel["decor"];
  officeViewSettings: OfficeSceneViewSettings;
  officeTheme: ReturnType<typeof getOfficeTheme>;
  sceneBuilderMode: boolean;
  onBackgroundClick: (event: ThreeEvent<MouseEvent>) => void;
  /** When in fixed 2.5D, current orthographic zoom for front-wall opacity. */
  cameraZoom?: number;
  /** When in fixed 2.5D, zoom range so front walls fade from full to transparent as you zoom in. */
  zoomRange?: { minZoom: number; maxZoom: number };
}): JSX.Element {
  const {
    floorRef,
    officeLayout,
    officeDecorSettings,
    officeViewSettings,
    officeTheme,
    sceneBuilderMode,
    onBackgroundClick,
    cameraZoom,
    zoomRange,
  } = props;
  const bounds = useMemo(() => getOfficeLayoutBounds(officeLayout), [officeLayout]);
  const tileSet = useMemo(() => getOfficeLayoutTileSet(officeLayout), [officeLayout]);
  const wallSegments = useMemo(() => getOfficeLayoutWallSegments(officeLayout), [officeLayout]);
  const wallColor = getWallColorPreset(officeDecorSettings.wallColorId).color;
  const baseWallOpacity = sceneBuilderMode ? 0.22 : officeViewSettings.viewProfile === "fixed_2_5d" ? 0.96 : 1;
  const frontWalls = getFrontWallsForOpacity(officeViewSettings);
  const isFixed25 = officeViewSettings.viewProfile === "fixed_2_5d" && zoomRange != null && cameraZoom != null;
  const frontWallOpacity =
    isFixed25 && zoomRange
      ? Math.max(
          0.08,
          baseWallOpacity -
            (baseWallOpacity - 0.08) *
              Math.min(1, (cameraZoom! - zoomRange.minZoom) / (zoomRange.maxZoom - zoomRange.minZoom)),
        )
      : baseWallOpacity;

  return (
    <>
      <mesh
        ref={floorRef}
        position={[bounds.centerX, -0.02, bounds.centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        name="floor"
        onClick={onBackgroundClick}
      >
        <planeGeometry args={[bounds.width, bounds.depth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {[...tileSet].map((tileKey) => {
        const tile = parseOfficeLayoutTileKey(tileKey);
        if (!tile) return null;
        return (
          <Box
            key={tileKey}
            args={[1, 0.08, 1]}
            position={[tile.x, -0.04, tile.z]}
            receiveShadow
            name={`floor-tile-${tileKey}`}
            onClick={onBackgroundClick}
          >
            <meshStandardMaterial
              color={resolveFloorTileColor(
                officeDecorSettings.floorPatternId,
                tile.x,
                tile.z,
                sceneBuilderMode,
              )}
              roughness={0.9}
              metalness={0.03}
            />
          </Box>
        );
      })}

      {wallSegments.map((segment) => {
        const isFront =
          segment.id.endsWith(":north") && frontWalls.frontNorth ||
          segment.id.endsWith(":south") && frontWalls.frontSouth ||
          segment.id.endsWith(":west") && frontWalls.frontWest ||
          segment.id.endsWith(":east") && frontWalls.frontEast;
        const opacity = isFront && isFixed25 ? frontWallOpacity : baseWallOpacity;
        return (
          <Box
            key={segment.id}
            args={[segment.width, WALL_HEIGHT, segment.depth]}
            position={segment.position}
            rotation={segment.rotation}
            castShadow
            receiveShadow
            name={`wall-${segment.id}`}
            onClick={onBackgroundClick}
          >
            <meshStandardMaterial
              color={wallColor}
              emissive={sceneBuilderMode ? officeTheme.scene.floor : "#000000"}
              emissiveIntensity={sceneBuilderMode ? 0.05 : 0}
              transparent
              opacity={opacity}
            />
          </Box>
        );
      })}
    </>
  );
}
