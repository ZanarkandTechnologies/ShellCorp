"use client";

/**
 * PROFILE HEAD
 * ============
 * Head mesh with profile image overlay for expert-imported employees.
 * Extracted from employee.tsx — self-contained Three.js mesh.
 *
 * KEY CONCEPTS:
 * - Skin-colored head mesh as base
 * - Profile image on front face using Html + occlude="blending"
 * - Hair-colored back panel to distinguish front from back
 *
 * MEMORY REFERENCES:
 * - MEM-0144 refactor: Phase 3a extraction
 */
import { memo, useState } from "react";
import { Box, Html } from "@react-three/drei";
import { HEAD_HEIGHT, HEAD_WIDTH, HAIR_HEIGHT } from "@/constants";

export const ProfileHead = memo(function ProfileHead({
  imageUrl,
  position,
  skinColor,
  hairColor,
  useCompactOverlayMode = false,
}: {
  imageUrl: string;
  position: [number, number, number];
  skinColor: string;
  hairColor: string;
  useCompactOverlayMode?: boolean;
}) {
  const [imageError, setImageError] = useState(false);

  const isValidUrl = imageUrl && imageUrl.trim().length > 0;

  const backHairDepth = HEAD_WIDTH * 0.3;

  return (
    <group position={position}>
      <Box args={[HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH]} castShadow>
        <meshStandardMaterial color={skinColor} />
      </Box>

      <Box
        args={[HEAD_WIDTH, HEAD_HEIGHT, backHairDepth]}
        position={[0, 0, -HEAD_WIDTH / 2 - backHairDepth / 2 + 0.01]}
        castShadow
      >
        <meshStandardMaterial color={hairColor} />
      </Box>

      {isValidUrl && !imageError && !useCompactOverlayMode && (
        <Html
          position={[0, 0, HEAD_WIDTH / 2 + 0.005]}
          center
          transform
          scale={0.3}
          occlude="blending"
          zIndexRange={[10, 0]}
          style={{
            pointerEvents: "none",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          <img
            src={imageUrl}
            alt="Profile"
            onError={() => setImageError(true)}
            style={{
              width: "40px",
              height: "25px",
              objectFit: "cover",
              borderRadius: "4px",
              display: "block",
              backfaceVisibility: "hidden",
            }}
          />
        </Html>
      )}
    </group>
  );
});
