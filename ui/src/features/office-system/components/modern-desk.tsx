import { Box } from "@react-three/drei";
import { InteractiveObject } from "./interactive-object";
import type { Id } from "@/lib/entity-types";

/** Modern workstation: slim desk, large monitor, keyboard. */
const DESK_COLOR = "#d4c4ad";
const LEG_COLOR = "#262626";
const MONITOR_BEZEL = "#171717";
const SCREEN_COLOR = "#1c1917";
const KEYBOARD_COLOR = "#404040";

const DESK_W = 1.4;
const DESK_D = 0.75;
const DESK_H = 0.04;
const LEG_H = 0.7;
const MONITOR_W = 0.55;
const MONITOR_H = 0.32;
const MONITOR_D = 0.04;

interface ModernDeskProps {
  objectId: Id<"officeObjects">;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  companyId?: Id<"companies">;
  metadata?: Record<string, unknown>;
}

export default function ModernDesk({
  objectId,
  position,
  rotation,
  scale,
  companyId,
  metadata,
}: ModernDeskProps) {
  const deskTopY = LEG_H + DESK_H / 2;

  return (
    <InteractiveObject
      objectType="modern-desk"
      objectId={objectId}
      companyId={companyId}
      initialPosition={position}
      initialRotation={rotation}
      initialScale={scale}
      metadata={metadata}
    >
      <group>
        {/* Desk top */}
        <Box args={[DESK_W, DESK_H, DESK_D]} position={[0, deskTopY, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={DESK_COLOR} roughness={0.55} metalness={0.02} />
        </Box>
        {/* Legs - two pedestals */}
        <Box
          args={[0.08, LEG_H, DESK_D - 0.1]}
          position={[-DESK_W / 2 + 0.1, LEG_H / 2, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={LEG_COLOR} roughness={0.45} metalness={0.5} />
        </Box>
        <Box
          args={[0.08, LEG_H, DESK_D - 0.1]}
          position={[DESK_W / 2 - 0.1, LEG_H / 2, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={LEG_COLOR} roughness={0.45} metalness={0.5} />
        </Box>
        {/* Monitor - stand */}
        <Box
          args={[0.12, 0.06, 0.2]}
          position={[0, deskTopY + DESK_H / 2 + 0.03, -DESK_D / 2 + 0.15]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={MONITOR_BEZEL} roughness={0.5} metalness={0.2} />
        </Box>
        {/* Monitor - screen */}
        <Box
          args={[MONITOR_W, MONITOR_H, MONITOR_D]}
          position={[0, deskTopY + 0.06 + MONITOR_H / 2, -DESK_D / 2 + 0.15]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={MONITOR_BEZEL} roughness={0.5} metalness={0.15} />
        </Box>
        {/* Screen face */}
        <Box
          args={[MONITOR_W - 0.04, MONITOR_H - 0.04, 0.01]}
          position={[0, deskTopY + 0.06 + MONITOR_H / 2, -DESK_D / 2 + 0.15 + MONITOR_D / 2 + 0.006]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={SCREEN_COLOR} roughness={0.8} metalness={0} />
        </Box>
        {/* Keyboard */}
        <Box
          args={[0.32, 0.02, 0.12]}
          position={[0.2, deskTopY + DESK_H / 2 + 0.01, DESK_D / 2 - 0.2]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={KEYBOARD_COLOR} roughness={0.5} metalness={0.1} />
        </Box>
      </group>
    </InteractiveObject>
  );
}
