import { Box, Cylinder } from "@react-three/drei";
import { InteractiveObject } from "./interactive-object";
import type { Id } from "@/lib/entity-types";

/** Modern desk lamp: matte black base and arm, white dome shade. */
const BASE_COLOR = "#171717";
const SHADE_COLOR = "#fafaf9";

interface LampProps {
  objectId: Id<"officeObjects">;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  companyId?: Id<"companies">;
  metadata?: Record<string, unknown>;
}

export default function Lamp({
  objectId,
  position,
  rotation,
  scale,
  companyId,
  metadata,
}: LampProps) {
  return (
    <InteractiveObject
      objectType="lamp"
      objectId={objectId}
      companyId={companyId}
      initialPosition={position}
      initialRotation={rotation}
      initialScale={scale}
      metadata={metadata}
    >
      <group>
        {/* Weighted base */}
        <Cylinder args={[0.12, 0.14, 0.04, 32]} position={[0, 0.02, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={BASE_COLOR} roughness={0.7} metalness={0.2} />
        </Cylinder>
        {/* Stem */}
        <Cylinder args={[0.018, 0.018, 0.42, 16]} position={[0, 0.25, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={BASE_COLOR} roughness={0.65} metalness={0.25} />
        </Cylinder>
        {/* Dome shade */}
        <Cylinder args={[0.14, 0.16, 0.14, 32]} position={[0, 0.5, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={SHADE_COLOR} roughness={0.9} metalness={0} />
        </Cylinder>
      </group>
    </InteractiveObject>
  );
}
