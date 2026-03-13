import { Cylinder, Sphere } from "@react-three/drei";
import { InteractiveObject } from "./interactive-object";
import type { Id } from "@/lib/entity-types";

/** Modern planter: concrete-style pot, lush foliage. */
const POT_COLOR = "#9ca3af";
const LEAF_COLOR = "#15803d";

interface PlantProps {
  objectId: Id<"officeObjects">;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  companyId?: Id<"companies">;
  metadata?: Record<string, unknown>;
}

export default function Plant({
  objectId,
  position,
  rotation,
  scale,
  companyId,
  metadata,
}: PlantProps) {
  return (
    <InteractiveObject
      objectType="plant"
      objectId={objectId}
      companyId={companyId}
      initialPosition={position}
      initialRotation={rotation}
      initialScale={scale}
      metadata={metadata}
    >
      <group>
        {/* Modern pot - tapered cylinder */}
        <Cylinder args={[0.28, 0.24, 0.4, 24]} position={[0, 0.2, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={POT_COLOR} roughness={0.85} metalness={0.02} />
        </Cylinder>
        {/* Foliage cluster */}
        <Sphere args={[0.4, 20, 20]} position={[0, 0.65, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={LEAF_COLOR} roughness={0.88} metalness={0} />
        </Sphere>
      </group>
    </InteractiveObject>
  );
}
