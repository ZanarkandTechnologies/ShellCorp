import { Box } from "@react-three/drei";
import { InteractiveObject } from "./interactive-object";
import type { Id } from "@/lib/entity-types";

/** Modern dining / meeting table: large top, sturdy legs. */
const TOP_COLOR = "#d4c4ad";
const LEG_COLOR = "#404040";

const TOP_W = 2.2;
const TOP_D = 1;
const TOP_H = 0.05;
const LEG_H = 0.72;

interface DiningTableProps {
  objectId: Id<"officeObjects">;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  companyId?: Id<"companies">;
  metadata?: Record<string, unknown>;
}

export default function DiningTable({
  objectId,
  position,
  rotation,
  scale,
  companyId,
  metadata,
}: DiningTableProps) {
  const yTop = LEG_H + TOP_H / 2;

  return (
    <InteractiveObject
      objectType="dining-table"
      objectId={objectId}
      companyId={companyId}
      initialPosition={position}
      initialRotation={rotation}
      initialScale={scale}
      metadata={metadata}
    >
      <group>
        {/* Table top */}
        <Box args={[TOP_W, TOP_H, TOP_D]} position={[0, yTop, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={TOP_COLOR} roughness={0.6} metalness={0.02} />
        </Box>
        {/* Legs */}
        <Box
          args={[0.08, LEG_H, 0.08]}
          position={[-TOP_W / 2 + 0.1, LEG_H / 2, -TOP_D / 2 + 0.1]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={LEG_COLOR} roughness={0.4} metalness={0.5} />
        </Box>
        <Box
          args={[0.08, LEG_H, 0.08]}
          position={[TOP_W / 2 - 0.1, LEG_H / 2, -TOP_D / 2 + 0.1]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={LEG_COLOR} roughness={0.4} metalness={0.5} />
        </Box>
        <Box
          args={[0.08, LEG_H, 0.08]}
          position={[-TOP_W / 2 + 0.1, LEG_H / 2, TOP_D / 2 - 0.1]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={LEG_COLOR} roughness={0.4} metalness={0.5} />
        </Box>
        <Box
          args={[0.08, LEG_H, 0.08]}
          position={[TOP_W / 2 - 0.1, LEG_H / 2, TOP_D / 2 - 0.1]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={LEG_COLOR} roughness={0.4} metalness={0.5} />
        </Box>
      </group>
    </InteractiveObject>
  );
}
