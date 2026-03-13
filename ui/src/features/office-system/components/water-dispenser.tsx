import { Box, Cylinder } from "@react-three/drei";
import { InteractiveObject } from "./interactive-object";
import type { Id } from "@/lib/entity-types";

/** Modern water dispenser: tall white unit with bottle top. */
const BODY_COLOR = "#f5f5f5";
const ACCENT_COLOR = "#0ea5e9";
const BOTTLE_COLOR = "#e0f2fe";

interface WaterDispenserProps {
  objectId: Id<"officeObjects">;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  companyId?: Id<"companies">;
  metadata?: Record<string, unknown>;
}

export default function WaterDispenser({
  objectId,
  position,
  rotation,
  scale,
  companyId,
  metadata,
}: WaterDispenserProps) {
  return (
    <InteractiveObject
      objectType="water-dispenser"
      objectId={objectId}
      companyId={companyId}
      initialPosition={position}
      initialRotation={rotation}
      initialScale={scale}
      metadata={metadata}
    >
      <group>
        {/* Base */}
        <Box args={[0.4, 0.12, 0.35]} position={[0, 0.06, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={BODY_COLOR} roughness={0.5} metalness={0.05} />
        </Box>
        {/* Main body */}
        <Box args={[0.32, 0.95, 0.28]} position={[0, 0.6, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={BODY_COLOR} roughness={0.45} metalness={0.08} />
        </Box>
        {/* Dispense area / front panel */}
        <Box args={[0.28, 0.2, 0.02]} position={[0, 0.35, 0.15]} castShadow receiveShadow>
          <meshStandardMaterial color={ACCENT_COLOR} roughness={0.5} metalness={0.1} />
        </Box>
        {/* Bottle (inverted on top) */}
        <Cylinder args={[0.14, 0.16, 0.4, 24]} position={[0, 1.28, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={BOTTLE_COLOR} roughness={0.3} metalness={0} />
        </Cylinder>
      </group>
    </InteractiveObject>
  );
}
