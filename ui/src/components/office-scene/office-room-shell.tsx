/**
 * OFFICE ROOM SHELL
 * =================
 * Floor, walls, and optional room features (carpet, windows, door, paintings).
 * Appearance driven by roomAppearance (floor type/color, wall color, toggles).
 */

import { Box } from "@react-three/drei";
import {
  FLOOR_SIZE,
  HALF_FLOOR,
  WALL_HEIGHT,
  WALL_THICKNESS,
} from "@/constants";
import type { getOfficeTheme } from "@/config/office-theme";
import type { ThreeEvent } from "@react-three/fiber";
import type * as THREE from "three";

export type RoomAppearance = {
  floorType: "wood" | "tile" | "concrete";
  floorColor: string;
  wallColor: string;
  windows: boolean;
  paintings: boolean;
  door: boolean;
  carpet: boolean;
  carpetColor: string;
};

function wallOpacityFromDistance(distance: number): number {
  const dMin = 8;
  const dMax = 28;
  if (distance <= dMin) return 0.08;
  if (distance >= dMax) return 1;
  return 0.08 + (1 - 0.08) * ((distance - dMin) / (dMax - dMin));
}

function floorRoughness(floorType: RoomAppearance["floorType"]): number {
  switch (floorType) {
    case "wood":
      return 0.75;
    case "tile":
      return 0.35;
    case "concrete":
      return 0.85;
    default:
      return 0.7;
  }
}

function floorMetalness(floorType: RoomAppearance["floorType"]): number {
  switch (floorType) {
    case "tile":
      return 0.08;
    default:
      return 0.02;
  }
}

export function OfficeRoomShell(props: {
  floorRef: React.RefObject<THREE.Mesh | null>;
  officeTheme: ReturnType<typeof getOfficeTheme>;
  onBackgroundClick: (event: ThreeEvent<MouseEvent>) => void;
  cameraDistance?: number;
  roomAppearance: RoomAppearance;
}): JSX.Element {
  const {
    floorRef,
    officeTheme,
    onBackgroundClick,
    cameraDistance = 35,
    roomAppearance: room,
  } = props;
  const wallOpacity = wallOpacityFromDistance(cameraDistance);

  return (
    <>
      {/* Main floor */}
      <Box
        ref={floorRef}
        args={[FLOOR_SIZE, WALL_THICKNESS, FLOOR_SIZE]}
        position={[0, -WALL_THICKNESS / 2, 0]}
        receiveShadow
        name="floor"
        onClick={onBackgroundClick}
      >
        <meshStandardMaterial
          color={room.floorColor}
          roughness={floorRoughness(room.floorType)}
          metalness={floorMetalness(room.floorType)}
        />
      </Box>

      {/* Optional carpet */}
      {room.carpet && (
        <Box
          args={[FLOOR_SIZE * 0.6, 0.005, FLOOR_SIZE * 0.5]}
          position={[0, 0.003, 0]}
          receiveShadow
          name="carpet"
          onClick={onBackgroundClick}
        >
          <meshStandardMaterial
            color={room.carpetColor}
            roughness={0.92}
            metalness={0}
          />
        </Box>
      )}

      {/* Back wall */}
      <Box
        args={[FLOOR_SIZE, WALL_HEIGHT, WALL_THICKNESS]}
        position={[0, WALL_HEIGHT / 2, -HALF_FLOOR]}
        castShadow
        receiveShadow
        name="wall-back"
        onClick={onBackgroundClick}
      >
        <meshStandardMaterial
          color={room.wallColor}
          transparent
          opacity={wallOpacity}
          roughness={0.8}
          metalness={0.02}
        />
      </Box>
      {/* Windows on back wall */}
      {room.windows && (
        <>
          <Box
            args={[1.4, 1.2, 0.02]}
            position={[-2, WALL_HEIGHT / 2 + 0.1, -HALF_FLOOR - 0.012]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color="#b0d4e8"
              transparent
              opacity={0.5}
              roughness={0.1}
              metalness={0.05}
            />
          </Box>
          <Box
            args={[1.4, 1.2, 0.02]}
            position={[2, WALL_HEIGHT / 2 + 0.1, -HALF_FLOOR - 0.012]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color="#b0d4e8"
              transparent
              opacity={0.5}
              roughness={0.1}
              metalness={0.05}
            />
          </Box>
        </>
      )}

      {/* Front wall (with optional door) */}
      <Box
        args={[FLOOR_SIZE, WALL_HEIGHT, WALL_THICKNESS]}
        position={[0, WALL_HEIGHT / 2, HALF_FLOOR]}
        castShadow
        receiveShadow
        name="wall-front"
        onClick={onBackgroundClick}
      >
        <meshStandardMaterial
          color={room.wallColor}
          transparent
          opacity={wallOpacity}
          roughness={0.8}
          metalness={0.02}
        />
      </Box>
      {room.door && (
        <Box
          args={[1.0, 2.0, 0.06]}
          position={[0, 0.25, HALF_FLOOR + 0.04]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color="#5c4a3a"
            roughness={0.7}
            metalness={0.05}
          />
        </Box>
      )}

      {/* Left wall */}
      <Box
        args={[WALL_THICKNESS, WALL_HEIGHT, FLOOR_SIZE + WALL_THICKNESS]}
        position={[-HALF_FLOOR, WALL_HEIGHT / 2, 0]}
        castShadow
        receiveShadow
        name="wall-left"
        onClick={onBackgroundClick}
      >
        <meshStandardMaterial
          color={room.wallColor}
          transparent
          opacity={wallOpacity}
          roughness={0.8}
          metalness={0.02}
        />
      </Box>
      {room.paintings && (
        <Box
          args={[0.6, 0.5, 0.03]}
          position={[-HALF_FLOOR - 0.016, WALL_HEIGHT / 2 + 0.1, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#2c2c2c" roughness={0.6} metalness={0} />
        </Box>
      )}

      {/* Right wall */}
      <Box
        args={[WALL_THICKNESS, WALL_HEIGHT, FLOOR_SIZE + WALL_THICKNESS]}
        position={[HALF_FLOOR, WALL_HEIGHT / 2, 0]}
        castShadow
        receiveShadow
        name="wall-right"
        onClick={onBackgroundClick}
      >
        <meshStandardMaterial
          color={room.wallColor}
          transparent
          opacity={wallOpacity}
          roughness={0.8}
          metalness={0.02}
        />
      </Box>
      {room.paintings && (
        <Box
          args={[0.6, 0.5, 0.03]}
          position={[HALF_FLOOR + 0.016, WALL_HEIGHT / 2 + 0.1, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#2c2c2c" roughness={0.6} metalness={0} />
        </Box>
      )}
    </>
  );
}
