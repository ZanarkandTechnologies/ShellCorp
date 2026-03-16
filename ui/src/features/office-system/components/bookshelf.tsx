import { Box } from "@react-three/drei";
import { useMemo } from "react";
import { InteractiveObject } from './interactive-object';
import type { Id } from "@/lib/entity-types";

interface BookshelfProps {
    objectId: Id<"officeObjects">;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
    companyId?: Id<"companies">;
    metadata?: Record<string, unknown>;
}

const PLANK_THICKNESS = 0.05;
const SIDE_WIDTH = 0.05;

/** Variant dimensions and colors so each catalog bookshelf looks different */
function getBookshelfVariant(furnitureId: string | undefined) {
  switch (furnitureId) {
    case "bookshelf-tall":
      return { width: 2.2, height: 2.2, depth: 0.4, numShelves: 6, color: "#5D4E37" };
    case "bookshelf-storage":
      return { width: 1.8, height: 1.2, depth: 0.35, numShelves: 3, color: "#A0522D" };
    case "misc-bookshelf":
      return { width: 2.0, height: 1.5, depth: 0.38, numShelves: 4, color: "#8B4513" };
    case "misc-bookshelf2":
      return { width: 1.5, height: 1.0, depth: 0.3, numShelves: 3, color: "#654321" };
    default:
      return { width: 2.5, height: 1.8, depth: 0.4, numShelves: 4, color: "#8B4513" };
  }
}

export default function Bookshelf({
    objectId,
    position,
    rotation = [0, 0, 0],
    scale,
    companyId,
    metadata,
}: BookshelfProps) {
    const furnitureId = typeof metadata?.furnitureId === "string" ? metadata.furnitureId : undefined;
    const variant = useMemo(() => getBookshelfVariant(furnitureId), [furnitureId]);
    const shelfSpacing = (variant.height - PLANK_THICKNESS) / variant.numShelves;

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
                <Box
                    args={[SIDE_WIDTH, variant.height, variant.depth]}
                    position={[-variant.width / 2 + SIDE_WIDTH / 2, variant.height / 2, 0]}
                    castShadow receiveShadow
                >
                    <meshStandardMaterial color={variant.color} />
                </Box>
                <Box
                    args={[SIDE_WIDTH, variant.height, variant.depth]}
                    position={[variant.width / 2 - SIDE_WIDTH / 2, variant.height / 2, 0]}
                    castShadow receiveShadow
                >
                    <meshStandardMaterial color={variant.color} />
                </Box>
                <Box
                    args={[variant.width - SIDE_WIDTH * 2, variant.height, PLANK_THICKNESS]}
                    position={[0, variant.height / 2, -variant.depth / 2 + PLANK_THICKNESS / 2]}
                    castShadow receiveShadow
                >
                    <meshStandardMaterial color={variant.color} opacity={0.8} />
                </Box>
                {Array.from({ length: variant.numShelves + 1 }).map((_, i) => (
                    <Box
                        key={`bookshelf-${objectId}-${i}`}
                        args={[variant.width - SIDE_WIDTH * 2, PLANK_THICKNESS, variant.depth - PLANK_THICKNESS]}
                        position={[0, PLANK_THICKNESS / 2 + i * shelfSpacing, 0]}
                        castShadow receiveShadow
                    >
                        <meshStandardMaterial color={variant.color} />
                    </Box>
                ))}
            </group>
        </InteractiveObject>
    );
}
