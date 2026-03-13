import { Box } from "@react-three/drei";
import { InteractiveObject } from "./interactive-object";
import type { Id } from "@/lib/entity-types";

/** Modern marble coffee table: thin top, metal legs. */
const MARBLE_COLOR = "#e8e6e3";
const LEG_COLOR = "#404040";

const TOP_W = 1.2;
const TOP_D = 0.65;
const TOP_H = 0.06;
const LEG_H = 0.38;

interface MarbleTableProps {
  objectId: Id<"officeObjects">;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  companyId?: Id<"companies">;
  metadata?: Record<string, unknown>;
}

export default function MarbleTable({
  objectId,
  position,
  rotation,
  scale,
  companyId,
  metadata,
}: MarbleTableProps) {
  const yTop = LEG_H + TOP_H / 2;

  return (
    <InteractiveObject
      objectType="marble-table"
      objectId={objectId}
      companyId={companyId}
      initialPosition={position}
      initialRotation={rotation}
      initialScale={scale}
      metadata={metadata}
    >
      <group>
        {/* Marble top */}
        <Box args={[TOP_W, TOP_H, TOP_D]} position={[0, yTop, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={MARBLE_COLOR} roughness={0.25} metalness={0.02} />
        </Box>
        {/* Legs */}
        <Box
          args={[0.06, LEG_H, 0.06]}
          position={[-TOP_W / 2 + 0.08, LEG_H / 2, -TOP_D / 2 + 0.08]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={LEG_COLOR} roughness={0.4} metalness={0.6} />
        </Box>
        <Box
          args={[0.06, LEG_H, 0.06]}
          position={[TOP_W / 2 - 0.08, LEG_H / 2, -TOP_D / 2 + 0.08]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={LEG_COLOR} roughness={0.4} metalness={0.6} />
        </Box>
        <Box
          args={[0.06, LEG_H, 0.06]}
          position={[-TOP_W / 2 + 0.08, LEG_H / 2, TOP_D / 2 - 0.08]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={LEG_COLOR} roughness={0.4} metalness={0.6} />
        </Box>
        <Box
          args={[0.06, LEG_H, 0.06]}
          position={[TOP_W / 2 - 0.08, LEG_H / 2, TOP_D / 2 - 0.08]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={LEG_COLOR} roughness={0.4} metalness={0.6} />
        </Box>
      </group>
    </InteractiveObject>
  );
}
