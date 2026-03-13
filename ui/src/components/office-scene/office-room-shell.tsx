/**
 * OFFICE ROOM SHELL
 * =================
 * Static floor and wall geometry for the office container.
 *
 * KEY CONCEPTS:
 * - Room chrome is static presentation and should not carry scene orchestration logic.
 *
 * USAGE:
 * - Render inside `SceneContents` and pass the floor ref plus background click handler.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 */

import { useEffect, useMemo } from "react";
import { Box } from "@react-three/drei";
import * as THREE from "three";
import { WALL_HEIGHT, WALL_THICKNESS } from "@/constants";
import type { getOfficeTheme } from "@/config/office-theme";
import type { ThreeEvent } from "@react-three/fiber";
import { getFloorPatternPreset, getWallColorPreset } from "@/lib/office-decor";
import type { OfficeFootprint } from "@/lib/office-footprint";
import { getOfficeFootprintHalfExtents } from "@/lib/office-footprint";
import type { OfficeSettingsModel } from "@/lib/openclaw-types";
import type { OfficeSceneViewSettings } from "./view-profile";

function getWallVisibility(settings: OfficeSceneViewSettings): {
  showBack: boolean;
  showFront: boolean;
  showLeft: boolean;
  showRight: boolean;
} {
  if (settings.viewProfile !== "fixed_2_5d") {
    return { showBack: true, showFront: true, showLeft: true, showRight: true };
  }

  switch (settings.cameraOrientation) {
    case "south_west":
      return { showBack: true, showFront: false, showLeft: false, showRight: true };
    case "north_east":
      return { showBack: false, showFront: true, showLeft: true, showRight: false };
    case "north_west":
      return { showBack: false, showFront: true, showLeft: false, showRight: true };
    case "south_east":
    default:
      return { showBack: true, showFront: false, showLeft: true, showRight: false };
  }
}

function buildFloorTexture(
  officeFootprint: OfficeFootprint,
  patternId: OfficeSettingsModel["decor"]["floorPatternId"],
): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const preset = getFloorPatternPreset(patternId);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const [base, accent, line] = preset.colors;
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (patternId === "sandstone_tiles") {
    const tileSize = 64;
    context.strokeStyle = line;
    context.lineWidth = 6;
    for (let x = 0; x <= canvas.width; x += tileSize) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 0; y <= canvas.height; y += tileSize) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }
    context.fillStyle = accent;
    for (let x = 0; x < canvas.width; x += tileSize) {
      for (let y = 0; y < canvas.height; y += tileSize) {
        context.fillRect(x + 8, y + 8, tileSize - 16, tileSize - 16);
      }
    }
  } else if (patternId === "graphite_grid") {
    const stripe = 48;
    context.fillStyle = accent;
    for (let i = -canvas.height; i < canvas.width; i += stripe) {
      context.fillRect(i, 0, 16, canvas.height);
      context.save();
      context.translate(i, 0);
      context.transform(1, 0.35, 0, 1, 0, 0);
      context.fillRect(0, -80, 14, canvas.height + 160);
      context.restore();
    }
    context.strokeStyle = line;
    context.lineWidth = 4;
    for (let x = 0; x <= canvas.width; x += 64) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
  } else {
    const plank = 72;
    context.fillStyle = accent;
    for (let row = 0; row < canvas.height; row += plank) {
      const offset = Math.floor(row / plank) % 2 === 0 ? 0 : plank / 2;
      for (let column = -offset; column < canvas.width; column += plank) {
        context.fillRect(column, row, plank - 6, plank - 6);
      }
    }
    context.strokeStyle = line;
    context.lineWidth = 3;
    for (let row = 0; row <= canvas.height; row += plank) {
      context.beginPath();
      context.moveTo(0, row);
      context.lineTo(canvas.width, row);
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    Math.max(2, officeFootprint.width / 6),
    Math.max(2, officeFootprint.depth / 6),
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function OfficeRoomShell(props: {
  floorRef: React.RefObject<THREE.Mesh | null>;
  officeFootprint: OfficeFootprint;
  officeDecorSettings: OfficeSettingsModel["decor"];
  officeViewSettings: OfficeSceneViewSettings;
  officeTheme: ReturnType<typeof getOfficeTheme>;
  sceneBuilderMode: boolean;
  onBackgroundClick: (event: ThreeEvent<MouseEvent>) => void;
}): JSX.Element {
  const {
    floorRef,
    officeFootprint,
    officeDecorSettings,
    officeViewSettings,
    officeTheme,
    sceneBuilderMode,
    onBackgroundClick,
  } = props;
  const { halfWidth, halfDepth } = getOfficeFootprintHalfExtents(officeFootprint);
  const isIsometricView = officeViewSettings.viewProfile === "fixed_2_5d";
  const wallOpacity = sceneBuilderMode ? 0.16 : isIsometricView ? 0.96 : 1;
  const { showBack, showFront, showLeft, showRight } = getWallVisibility(officeViewSettings);
  const floorTexture = useMemo(
    () => buildFloorTexture(officeFootprint, officeDecorSettings.floorPatternId),
    [officeDecorSettings.floorPatternId, officeFootprint],
  );
  const wallColor = getWallColorPreset(officeDecorSettings.wallColorId).color;

  useEffect(
    () => () => {
      floorTexture?.dispose();
    },
    [floorTexture],
  );

  return (
    <>
      <Box
        ref={floorRef}
        args={[officeFootprint.width, WALL_THICKNESS, officeFootprint.depth]}
        position={[0, -WALL_THICKNESS / 2, 0]}
        receiveShadow
        name="floor"
        onClick={onBackgroundClick}
      >
        <meshStandardMaterial
          color={officeTheme.scene.floor}
          map={floorTexture ?? undefined}
          roughness={0.9}
          metalness={0.05}
        />
      </Box>

      {showBack ? (
        <Box
          args={[officeFootprint.width, WALL_HEIGHT, WALL_THICKNESS]}
          position={[0, WALL_HEIGHT / 2, -halfDepth]}
          castShadow
          receiveShadow
          name="wall-back"
          onClick={onBackgroundClick}
        >
          <meshStandardMaterial color={wallColor} transparent opacity={wallOpacity} />
        </Box>
      ) : null}
      {showFront ? (
        <Box
          args={[officeFootprint.width, WALL_HEIGHT, WALL_THICKNESS]}
          position={[0, WALL_HEIGHT / 2, halfDepth]}
          castShadow
          receiveShadow
          name="wall-front"
          onClick={onBackgroundClick}
        >
          <meshStandardMaterial color={wallColor} transparent opacity={wallOpacity} />
        </Box>
      ) : null}
      {showLeft ? (
        <Box
          args={[WALL_THICKNESS, WALL_HEIGHT, officeFootprint.depth + WALL_THICKNESS]}
          position={[-halfWidth, WALL_HEIGHT / 2, 0]}
          castShadow
          receiveShadow
          name="wall-left"
          onClick={onBackgroundClick}
        >
          <meshStandardMaterial color={wallColor} transparent opacity={wallOpacity} />
        </Box>
      ) : null}
      {showRight ? (
        <Box
          args={[WALL_THICKNESS, WALL_HEIGHT, officeFootprint.depth + WALL_THICKNESS]}
          position={[halfWidth, WALL_HEIGHT / 2, 0]}
          castShadow
          receiveShadow
          name="wall-right"
          onClick={onBackgroundClick}
        >
          <meshStandardMaterial color={wallColor} transparent opacity={wallOpacity} />
        </Box>
      ) : null}
    </>
  );
}
