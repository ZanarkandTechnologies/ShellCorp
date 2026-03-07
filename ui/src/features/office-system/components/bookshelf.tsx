import { Box } from "@react-three/drei";
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

// Dimensions
const SHELF_WIDTH = 2.5;
const SHELF_HEIGHT = 1.8;
const SHELF_DEPTH = 0.4;
const PLANK_THICKNESS = 0.05;
const SIDE_WIDTH = 0.05;

// Colors
const WOOD_COLOR = "#8B4513"; // SaddleBrown

export default function Bookshelf({
    objectId,
    position,
    rotation = [0, 0, 0],
    scale,
    companyId,
    metadata,
}: BookshelfProps) {
    const numShelves = 4;
    const shelfSpacing = (SHELF_HEIGHT - PLANK_THICKNESS) / numShelves;

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
                {/* Sides */}
                <Box
                    args={[SIDE_WIDTH, SHELF_HEIGHT, SHELF_DEPTH]}
                    position={[-SHELF_WIDTH / 2 + SIDE_WIDTH / 2, SHELF_HEIGHT / 2, 0]}
                    castShadow receiveShadow
                >
                    <meshStandardMaterial color={WOOD_COLOR} />
                </Box>
                <Box
                    args={[SIDE_WIDTH, SHELF_HEIGHT, SHELF_DEPTH]}
                    position={[SHELF_WIDTH / 2 - SIDE_WIDTH / 2, SHELF_HEIGHT / 2, 0]}
                    castShadow receiveShadow
                >
                    <meshStandardMaterial color={WOOD_COLOR} />
                </Box>

                {/* Back */}
                <Box
                    args={[SHELF_WIDTH - SIDE_WIDTH * 2, SHELF_HEIGHT, PLANK_THICKNESS]}
                    position={[0, SHELF_HEIGHT / 2, -SHELF_DEPTH / 2 + PLANK_THICKNESS / 2]}
                    castShadow receiveShadow
                >
                    <meshStandardMaterial color={WOOD_COLOR} opacity={0.8} />
                </Box>

                {/* Shelves */}
                {Array.from({ length: numShelves + 1 }).map((_, i) => (
                    <Box
                        key={`bookshelf-${objectId}-${i}`}
                        args={[SHELF_WIDTH - SIDE_WIDTH * 2, PLANK_THICKNESS, SHELF_DEPTH - PLANK_THICKNESS]}
                        position={[0, PLANK_THICKNESS / 2 + i * shelfSpacing, 0]}
                        castShadow receiveShadow
                    >
                        <meshStandardMaterial color={WOOD_COLOR} />
                    </Box>
                ))}
            </group>
        </InteractiveObject>
    );
} 