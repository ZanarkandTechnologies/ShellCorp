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

function resolvePalette(employee: EmployeeData | null): AvatarPalette {
  const seed = `${employee?._id ?? "agent"}:${employee?.name ?? "agent"}`;
  if (employee?.isCEO) {
    return {
      hair: "#FFD700",
      skin: "#FF5722",
      shirt: "#CC2200",
      pants: "#8B0000",
    };
  }
  return {
    hair: pickStableColor(`${seed}:hair`, HAIR_COLORS),
    skin: pickStableColor(`${seed}:skin`, SKIN_COLORS),
    shirt: pickStableColor(`${seed}:shirt`, SHIRT_COLORS),
    pants: pickStableColor(`${seed}:pants`, PANTS_COLORS),
  };
}

function EmployeePreviewMesh({ palette }: { palette: AvatarPalette }): JSX.Element {
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
      <Box
        args={[HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH]}
        position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.skin} />
      </Box>
      <Box
        args={[HAIR_WIDTH, HAIR_HEIGHT, HAIR_WIDTH]}
        position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT + HAIR_HEIGHT / 2, 0]}
        castShadow
      >
        <meshStandardMaterial color={palette.hair} />
      </Box>
    </group>
  );
}

export function EmployeePreviewCard({
  employee,
  displayName,
}: {
  employee: EmployeeData | null;
  displayName: string;
}): JSX.Element {
  const palette = useMemo(() => resolvePalette(employee), [employee]);

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium">{displayName}</p>
        <p className="text-xs text-muted-foreground">Office character preview</p>
      </div>
      <div className="overflow-hidden rounded-md border bg-background">
        <div className="h-56 w-full">
          <Canvas camera={{ position: [0, 0.58, 3.2], fov: 24 }} shadows>
            <ambientLight intensity={1.4} />
            <directionalLight position={[2, 3, 4]} intensity={2.2} castShadow />
            <directionalLight position={[-2, 1.5, 2]} intensity={0.8} />
            <group scale={1.75}>
              <EmployeePreviewMesh palette={palette} />
            </group>
            <OrbitControls
              enablePan={false}
              enableZoom={false}
              autoRotate={false}
              target={[0, 0.18, 0]}
            />
          </Canvas>
        </div>
      </div>
    </div>
  );
}
