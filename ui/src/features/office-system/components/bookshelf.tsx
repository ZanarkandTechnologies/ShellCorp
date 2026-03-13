import { Box } from "@react-three/drei";
import { InteractiveObject } from "./interactive-object";
import type { Id } from "@/lib/entity-types";

/** Modern open shelving: light wood tone, thin shelves, clean frame. */
const FRAME_COLOR = "#c4b5a0";
const SHELF_COLOR = "#d4c4ad";
const W = 1.8;
const H = 1.6;
const D = 0.32;
const THICK = 0.04;
const NUM_SHELVES = 4;

interface BookshelfProps {
  objectId: Id<"officeObjects">;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  companyId?: Id<"companies">;
  metadata?: Record<string, unknown>;
}

export default function Bookshelf({
  objectId,
  position,
  rotation = [0, 0, 0],
  scale,
  companyId,
  metadata,
}: BookshelfProps) {
  const spacing = (H - THICK) / NUM_SHELVES;

  return (
    <InteractiveObject
      objectType="bookshelf"
      objectId={objectId}
      companyId={companyId}
      initialPosition={position}
      initialRotation={rotation}
      initialScale={scale}
      metadata={metadata}
    >
      <group>
        {/* Left upright */}
        <Box args={[THICK, H, D]} position={[-W / 2 + THICK / 2, H / 2, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={FRAME_COLOR} roughness={0.75} metalness={0.05} />
        </Box>
        {/* Right upright */}
        <Box args={[THICK, H, D]} position={[W / 2 - THICK / 2, H / 2, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={FRAME_COLOR} roughness={0.75} metalness={0.05} />
        </Box>
        {/* Shelves */}
        {Array.from({ length: NUM_SHELVES + 1 }).map((_, i) => (
          <Box
            key={`shelf-${objectId}-${i}`}
            args={[W - THICK * 2, THICK, D]}
            position={[0, i * spacing + THICK / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={SHELF_COLOR} roughness={0.7} metalness={0} />
          </Box>
        ))}
      </group>
    </InteractiveObject>
  );
}
