import { Box, Cylinder } from "@react-three/drei";
import { InteractiveObject } from "./interactive-object";
import type { Id } from "@/lib/entity-types";

/** Modern break counter: white top, minimal base, coffee machine + vessel. */
const COUNTER_COLOR = "#fafaf9";
const BASE_COLOR = "#e5e5e5";
const APPLIANCE_COLOR = "#171717";
const ACCENT_COLOR = "#0ea5e9";

const L = 2.8;
const H = 0.95;
const D = 0.7;

interface PantryProps {
  objectId: Id<"officeObjects">;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  companyId?: Id<"companies">;
  metadata?: Record<string, unknown>;
}

export default function Pantry({
  objectId,
  position,
  rotation,
  scale,
  companyId,
  metadata,
}: PantryProps) {
  const topY = H;

  return (
    <InteractiveObject
      objectType="pantry"
      objectId={objectId}
      companyId={companyId}
      initialPosition={position}
      initialRotation={rotation}
      initialScale={scale}
      metadata={metadata}
    >
      <group>
        {/* Counter top */}
        <Box args={[L, 0.08, D]} position={[0, topY - 0.04, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={COUNTER_COLOR} roughness={0.4} metalness={0.05} />
        </Box>
        {/* Base cabinet */}
        <Box args={[L - 0.1, H - 0.12, D - 0.08]} position={[0, (H - 0.12) / 2, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={BASE_COLOR} roughness={0.6} metalness={0.02} />
        </Box>
        {/* Coffee machine */}
        <Box
          args={[0.45, 0.32, 0.35]}
          position={[-L / 2 + 0.35, topY + 0.16, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={APPLIANCE_COLOR} roughness={0.5} metalness={0.15} />
        </Box>
        {/* Carafe / vessel */}
        <Cylinder args={[0.1, 0.09, 0.22, 20]} position={[-L / 2 + 0.9, topY + 0.13, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={APPLIANCE_COLOR} roughness={0.4} metalness={0.25} />
        </Cylinder>
        {/* Small accent (button or plant) */}
        <Cylinder args={[0.06, 0.06, 0.12, 16]} position={[L / 2 - 0.25, topY + 0.08, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={ACCENT_COLOR} roughness={0.5} metalness={0.1} />
        </Cylinder>
      </group>
    </InteractiveObject>
  );
}
