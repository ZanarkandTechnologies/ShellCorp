import { Box } from "@react-three/drei";
import { InteractiveObject } from "./interactive-object";
import type { Id } from "@/lib/entity-types";

/** Modern WeWork-style lounge sofa: low profile, clean lines, soft neutral. */
const SOFA_COLOR = "#e8e4df";
const SEAT_HEIGHT = 0.38;
const BACK_HEIGHT = 0.5;
const DEPTH = 0.95;
const WIDTH = 2.2;

interface CouchProps {
  objectId: Id<"officeObjects">;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  companyId?: Id<"companies">;
  metadata?: Record<string, unknown>;
}

export default function Couch({
  objectId,
  position,
  rotation,
  scale,
  companyId,
  metadata,
}: CouchProps) {
  return (
    <InteractiveObject
      objectType="couch"
      objectId={objectId}
      companyId={companyId}
      initialPosition={position}
      initialRotation={rotation}
      initialScale={scale}
      metadata={metadata}
    >
      <group>
        {/* Base / seat cushion */}
        <Box
          args={[WIDTH, SEAT_HEIGHT, DEPTH]}
          position={[0, SEAT_HEIGHT / 2, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={SOFA_COLOR} roughness={0.92} metalness={0} />
        </Box>
        {/* Low back */}
        <Box
          args={[WIDTH, BACK_HEIGHT, 0.16]}
          position={[0, SEAT_HEIGHT + BACK_HEIGHT / 2, -DEPTH / 2 + 0.08]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={SOFA_COLOR} roughness={0.92} metalness={0} />
        </Box>
        {/* Minimal arm L */}
        <Box
          args={[0.12, BACK_HEIGHT * 0.7, DEPTH * 0.5]}
          position={[-WIDTH / 2 - 0.06, SEAT_HEIGHT + BACK_HEIGHT * 0.35, -DEPTH * 0.25]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={SOFA_COLOR} roughness={0.92} metalness={0} />
        </Box>
        {/* Minimal arm R */}
        <Box
          args={[0.12, BACK_HEIGHT * 0.7, DEPTH * 0.5]}
          position={[WIDTH / 2 + 0.06, SEAT_HEIGHT + BACK_HEIGHT * 0.35, -DEPTH * 0.25]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={SOFA_COLOR} roughness={0.92} metalness={0} />
        </Box>
      </group>
    </InteractiveObject>
  );
}
