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

function getWallVisibility(settings: OfficeSceneViewSettings): {
  showNorth: boolean;
  showSouth: boolean;
  showWest: boolean;
  showEast: boolean;
} {
  if (settings.viewProfile !== "fixed_2_5d") {
    return { showNorth: true, showSouth: true, showWest: true, showEast: true };
  }

  switch (settings.cameraOrientation) {
    case "south_west":
      return { showNorth: true, showSouth: false, showWest: false, showEast: true };
    case "north_east":
      return { showNorth: false, showSouth: true, showWest: true, showEast: false };
    case "north_west":
      return { showNorth: false, showSouth: true, showWest: false, showEast: true };
    case "south_east":
    default:
      return { showNorth: true, showSouth: false, showWest: true, showEast: false };
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
}): JSX.Element {
  const {
    floorRef,
    officeLayout,
    officeDecorSettings,
    officeViewSettings,
    officeTheme,
    sceneBuilderMode,
    onBackgroundClick,
  } = props;
  const bounds = useMemo(() => getOfficeLayoutBounds(officeLayout), [officeLayout]);
  const tileSet = useMemo(() => getOfficeLayoutTileSet(officeLayout), [officeLayout]);
  const wallSegments = useMemo(() => getOfficeLayoutWallSegments(officeLayout), [officeLayout]);
  const wallColor = getWallColorPreset(officeDecorSettings.wallColorId).color;
  const wallOpacity = sceneBuilderMode ? 0.22 : officeViewSettings.viewProfile === "fixed_2_5d" ? 0.96 : 1;
  const { showNorth, showSouth, showWest, showEast } = getWallVisibility(officeViewSettings);

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

      {wallSegments
        .filter((segment) => {
          if (segment.id.endsWith(":north")) return showNorth;
          if (segment.id.endsWith(":south")) return showSouth;
          if (segment.id.endsWith(":west")) return showWest;
          if (segment.id.endsWith(":east")) return showEast;
          return true;
        })
        .map((segment) => (
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
              opacity={wallOpacity}
            />
          </Box>
        ))}
    </>
  );
}
