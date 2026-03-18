"use client";

/**
 * MANAGE AGENT EMPLOYEE PREVIEW CARD
 * ==================================
 * Lightweight 3D preview for the selected office employee so the
 * overview tab can show the real in-world character silhouette.
 *
 * KEY CONCEPTS:
 * - Reuses the same geometric language as office employees without mounting the full scene runtime.
 * - Keeps rendering deterministic by deriving palette choices from stable employee text fields.
 *
 * USAGE:
 * - Mounted from `OverviewTab.tsx` on the left side of the overview split layout.
 *
 * MEMORY REFERENCES:
 * - MEM-0107
 */

import { Box, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import {
  BODY_HEIGHT,
  BODY_WIDTH,
  HAIR_COLORS,
  HAIR_HEIGHT,
  HAIR_WIDTH,
  HEAD_HEIGHT,
  HEAD_WIDTH,
  LEG_HEIGHT,
  PANTS_COLORS,
  SHIRT_COLORS,
  SKIN_COLORS,
  TOTAL_HEIGHT,
} from "@/constants";
import type { EmployeeData } from "@/lib/types";

type AppearanceOverrides = {
  clothesStyle?: "default" | "dj" | "professional" | "techBro";
  hairColorOverride?: string | null;
  petType?: "none" | "dog" | "cat" | "goldfish" | "rabbit" | "lobster";
};

type AvatarPalette = {
  hair: string;
  skin: string;
  shirt: string;
  pants: string;
};

function pickStableColor(seed: string, palette: readonly string[]): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return palette[hash % palette.length] ?? palette[0] ?? "#888888";
}

function resolvePalette(employee: EmployeeData | null, overrides?: AppearanceOverrides): AvatarPalette {
  const seed = `${employee?._id ?? "agent"}:${employee?.name ?? "agent"}`;
  const basePalette: AvatarPalette =
    employee?.isCEO
      ? {
      hair: "#FFD700",
      skin: "#FF5722",
      shirt: "#CC2200",
      pants: "#8B0000",
        }
      : {
          hair: pickStableColor(`${seed}:hair`, HAIR_COLORS),
          skin: pickStableColor(`${seed}:skin`, SKIN_COLORS),
          shirt: pickStableColor(`${seed}:shirt`, SHIRT_COLORS),
          pants: pickStableColor(`${seed}:pants`, PANTS_COLORS),
        };

  if (!overrides) {
    return basePalette;
  }

  let nextShirt = basePalette.shirt;
  let nextPants = basePalette.pants;

  switch (overrides.clothesStyle) {
    case "dj":
      nextShirt = "#FF4081";
      nextPants = "#111111";
      break;
    case "professional":
      nextShirt = "#ECEFF1";
      nextPants = "#263238";
      break;
    case "techBro":
      nextShirt = "#37474F";
      nextPants = "#111111";
      break;
    case "default":
    default:
      nextShirt = "#90A4AE";
      nextPants = "#1565C0";
      break;
  }

  return {
    hair: overrides.hairColorOverride ?? basePalette.hair,
    skin: basePalette.skin,
    shirt: nextShirt,
    pants: nextPants,
  };
}

function PetMesh({
  type,
}: {
  type: "dog" | "cat" | "goldfish" | "rabbit" | "lobster";
}): JSX.Element | null {
  if (type === "dog") {
    return (
      <group position={[-BODY_WIDTH * 0.9, -TOTAL_HEIGHT / 2 + LEG_HEIGHT, BODY_WIDTH * 0.25]}>
        <Box args={[0.26, 0.16, 0.46]} position={[0, 0.08, 0]} castShadow>
          <meshStandardMaterial color="#8D6E63" />
        </Box>
        <Box args={[0.2, 0.18, 0.22]} position={[0, 0.2, 0.18]} castShadow>
          <meshStandardMaterial color="#5D4037" />
        </Box>
        <Box args={[0.06, 0.08, 0.06]} position={[-0.08, 0.3, 0.32]} castShadow>
          <meshStandardMaterial color="#5D4037" />
        </Box>
        <Box args={[0.06, 0.08, 0.06]} position={[0.08, 0.3, 0.32]} castShadow>
          <meshStandardMaterial color="#5D4037" />
        </Box>
      </group>
    );
  }

  if (type === "cat") {
    return (
      <group position={[BODY_WIDTH * 0.9, -TOTAL_HEIGHT / 2 + LEG_HEIGHT, BODY_WIDTH * 0.1]}>
        <Box args={[0.22, 0.14, 0.4]} position={[0, 0.07, 0]} castShadow>
          <meshStandardMaterial color="#B0BEC5" />
        </Box>
        <Box args={[0.18, 0.16, 0.2]} position={[0, 0.2, 0.14]} castShadow>
          <meshStandardMaterial color="#78909C" />
        </Box>
        <Box args={[0.06, 0.06, 0.06]} position={[-0.08, 0.3, 0.24]} castShadow>
          <meshStandardMaterial color="#78909C" />
        </Box>
        <Box args={[0.06, 0.06, 0.06]} position={[0.08, 0.3, 0.24]} castShadow>
          <meshStandardMaterial color="#78909C" />
        </Box>
      </group>
    );
  }

  if (type === "goldfish") {
    return (
      <group position={[BODY_WIDTH * 0.1, -TOTAL_HEIGHT / 2 + LEG_HEIGHT + 0.12, -BODY_WIDTH * 0.9]}>
        <Box args={[0.3, 0.2, 0.3]} position={[0, 0.1, 0]} castShadow>
          <meshStandardMaterial color="#B3E5FC" opacity={0.85} transparent />
        </Box>
        <Box args={[0.1, 0.06, 0.18]} position={[0, 0.13, 0]} castShadow>
          <meshStandardMaterial color="#FF9800" />
        </Box>
        <Box args={[0.06, 0.04, 0.1]} position={[0, 0.13, -0.12]} castShadow>
          <meshStandardMaterial color="#FFB74D" />
        </Box>
      </group>
    );
  }

  if (type === "rabbit") {
    return (
      <group position={[BODY_WIDTH * 0.9, -TOTAL_HEIGHT / 2 + LEG_HEIGHT, BODY_WIDTH * 0.2]}>
        <Box args={[0.2, 0.14, 0.32]} position={[0, 0.07, 0]} castShadow>
          <meshStandardMaterial color="#E0E0E0" />
        </Box>
        <Box args={[0.12, 0.2, 0.12]} position={[-0.06, 0.22, 0.08]} castShadow>
          <meshStandardMaterial color="#E0E0E0" />
        </Box>
        <Box args={[0.12, 0.2, 0.12]} position={[0.06, 0.22, 0.08]} castShadow>
          <meshStandardMaterial color="#E0E0E0" />
        </Box>
        <Box args={[0.06, 0.05, 0.08]} position={[0, 0.06, -0.18]} castShadow>
          <meshStandardMaterial color="#BDBDBD" />
        </Box>
      </group>
    );
  }

  if (type === "lobster") {
    return (
      <group position={[BODY_WIDTH * 0.85, -TOTAL_HEIGHT / 2 + LEG_HEIGHT, BODY_WIDTH * 0.25]}>
        <Box args={[0.22, 0.1, 0.4]} position={[0, 0.05, 0]} castShadow>
          <meshStandardMaterial color="#D84315" />
        </Box>
        <Box args={[0.08, 0.06, 0.14]} position={[-0.1, 0.06, 0.2]} castShadow>
          <meshStandardMaterial color="#D84315" />
        </Box>
        <Box args={[0.08, 0.06, 0.14]} position={[0.1, 0.06, 0.2]} castShadow>
          <meshStandardMaterial color="#D84315" />
        </Box>
        <Box args={[0.06, 0.05, 0.12]} position={[0, 0.05, -0.22]} castShadow>
          <meshStandardMaterial color="#BF360C" />
        </Box>
      </group>
    );
  }

  return null;
}

function EmployeePreviewMesh({
  palette,
  petType,
  clothesStyle,
}: {
  palette: AvatarPalette;
  petType?: "dog" | "cat" | "goldfish" | "rabbit" | "lobster" | "none";
  clothesStyle?: "default" | "dj" | "professional" | "techBro";
}): JSX.Element {
  const baseY = -TOTAL_HEIGHT / 2;
  return (
    <group position={[0, -0.24, 0]} rotation={[0.08, -0.38, 0]}>
      <Box
        args={[BODY_WIDTH, LEG_HEIGHT, BODY_WIDTH * 0.6]}
        position={[0, baseY + LEG_HEIGHT / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.pants} />
      </Box>
      <Box
        args={[BODY_WIDTH, BODY_HEIGHT, BODY_WIDTH * 0.6]}
        position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.shirt} />
      </Box>
      {clothesStyle === "techBro" ? (
        <Box
          args={[BODY_WIDTH * 0.9, BODY_HEIGHT * 0.5, BODY_WIDTH * 0.35]}
          position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT * 0.85, -BODY_WIDTH * 0.42]}
          castShadow
        >
          <meshStandardMaterial color={palette.shirt} />
        </Box>
      ) : null}
      <Box
        args={[HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH]}
        position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.skin} />
      </Box>
      <group
        position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT + HAIR_HEIGHT / 2, 0]}
      >
        <Box args={[HAIR_WIDTH, HAIR_HEIGHT, HAIR_WIDTH]} castShadow>
          <meshStandardMaterial color={palette.hair} />
        </Box>
        {clothesStyle === "dj" ? (
          <>
            <Box args={[HAIR_WIDTH * 0.6, HAIR_HEIGHT * 0.6, HAIR_WIDTH * 0.4]} position={[0, 0.12, 0.22]} castShadow>
              <meshStandardMaterial color={palette.hair} />
            </Box>
          </>
        ) : clothesStyle === "professional" ? (
          <Box
            args={[HAIR_WIDTH * 0.5, HAIR_HEIGHT * 0.4, HAIR_WIDTH * 0.2]}
            position={[0.12, 0.06, 0.24]}
            castShadow
          >
            <meshStandardMaterial color={palette.hair} />
          </Box>
        ) : clothesStyle === "techBro" ? (
          <Box
            args={[HAIR_WIDTH * 0.7, HAIR_HEIGHT * 0.5, HAIR_WIDTH * 0.5]}
            position={[0, 0.14, -0.06]}
            castShadow
          >
            <meshStandardMaterial color={palette.hair} />
          </Box>
        ) : null}
      </group>
      <Box
        args={[HEAD_WIDTH * 0.12, HEAD_HEIGHT * 0.16, 0.02]}
        position={[-HEAD_WIDTH * 0.18, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT * 0.1, HEAD_WIDTH * 0.5]}
        castShadow
      >
        <meshStandardMaterial color="#111111" />
      </Box>
      <Box
        args={[HEAD_WIDTH * 0.12, HEAD_HEIGHT * 0.16, 0.02]}
        position={[HEAD_WIDTH * 0.18, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT * 0.1, HEAD_WIDTH * 0.5]}
        castShadow
      >
        <meshStandardMaterial color="#111111" />
      </Box>
      {clothesStyle === "dj" ? (
        <Box
          args={[BODY_WIDTH * 0.8, BODY_HEIGHT * 0.2, BODY_WIDTH * 0.05]}
          position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT * 0.6, BODY_WIDTH * 0.34]}
          castShadow
        >
          <meshStandardMaterial color="#FFEB3B" />
        </Box>
      ) : clothesStyle === "professional" ? (
        <Box
          args={[BODY_WIDTH * 0.12, BODY_HEIGHT * 0.7, BODY_WIDTH * 0.05]}
          position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT * 0.5, BODY_WIDTH * 0.34]}
          castShadow
        >
          <meshStandardMaterial color="#B71C1C" />
        </Box>
      ) : clothesStyle === "techBro" ? (
        <Box
          args={[BODY_WIDTH * 0.7, BODY_HEIGHT * 0.22, BODY_WIDTH * 0.04]}
          position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT * 0.3, BODY_WIDTH * 0.34]}
          castShadow
        >
          <meshStandardMaterial color="#263238" />
        </Box>
      ) : null}
      {petType && petType !== "none" ? <PetMesh type={petType} /> : null}
    </group>
  );
}

export function EmployeePreviewCard({
  employee,
  displayName,
  appearanceOverrides,
}: {
  employee: EmployeeData | null;
  displayName: string;
  appearanceOverrides?: AppearanceOverrides;
}): JSX.Element {
  const palette = useMemo(
    () => resolvePalette(employee, appearanceOverrides),
    [employee, appearanceOverrides],
  );
  const petType = appearanceOverrides?.petType ?? "none";
  const clothesStyle = appearanceOverrides?.clothesStyle ?? "default";

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-4">
      <p className="text-sm font-medium">Office character preview</p>
      <div className="overflow-hidden rounded-md border bg-background">
        <div className="h-56 w-full">
          <Canvas camera={{ position: [0, 0.58, 3.2], fov: 24 }} shadows>
            <ambientLight intensity={1.4} />
            <directionalLight position={[2, 3, 4]} intensity={2.2} castShadow />
            <directionalLight position={[-2, 1.5, 2]} intensity={0.8} />
            <group scale={1.75}>
              <EmployeePreviewMesh
                palette={palette}
                petType={petType}
                clothesStyle={clothesStyle}
              />
            </group>
            <OrbitControls
              enablePan={false}
              enableZoom
              autoRotate={false}
              minDistance={2.4}
              maxDistance={5.5}
              target={[0, 0.18, 0]}
            />
          </Canvas>
        </div>
      </div>
    </div>
  );
}
