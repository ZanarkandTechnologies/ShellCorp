import { Box, Cylinder } from "@react-three/drei";
import { useMemo } from "react";
import { InteractiveObject } from './interactive-object';
import type { Id } from "@/lib/entity-types";

interface PantryProps {
    objectId: Id<"officeObjects">;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
    companyId?: Id<"companies">;
    metadata?: Record<string, unknown>;
}

/** Variant layout and colors so each catalog pantry looks different */
function getPantryVariant(furnitureId: string | undefined) {
  switch (furnitureId) {
    case "pantry-supply":
      return { counterLength: 4, counterColor: "#F5F5DC", fridgeColor: "#C0C0C0", hasFridge: true, hasMicrowave: false, jugCount: 1 };
    case "pantry-counter":
      return { counterLength: 6, counterColor: "#FFFFFF", fridgeColor: "#E0E0E0", hasFridge: true, hasMicrowave: true, jugCount: 2 };
    case "misc-pantry":
      return { counterLength: 2.5, counterColor: "#FFF8DC", fridgeColor: "#D3D3D3", hasFridge: false, hasMicrowave: true, jugCount: 1 };
    default:
      return { counterLength: 6, counterColor: "#FFFFFF", fridgeColor: "#E0E0E0", hasFridge: true, hasMicrowave: true, jugCount: 2 };
  }
}

const COUNTER_HEIGHT = 1;
const COUNTER_DEPTH = 1;
const FRIDGE_WIDTH = 0.8;
const FRIDGE_HEIGHT = 1.8;
const FRIDGE_DEPTH = 0.75;
const MICROWAVE_WIDTH = 0.6;
const MICROWAVE_HEIGHT = 0.3;
const MICROWAVE_DEPTH = 0.4;
const JUG_RADIUS = 0.1;
const JUG_HEIGHT = 0.25;
const MICROWAVE_COLOR = "#333333";
const JUG_COLOR = "#ADD8E6";

export default function Pantry({
    objectId,
    position,
    rotation,
    scale,
    companyId,
    metadata,
}: PantryProps) {
    const furnitureId = typeof metadata?.furnitureId === "string" ? metadata.furnitureId : undefined;
    const v = useMemo(() => getPantryVariant(furnitureId), [furnitureId]);
    const fridgePositionX = v.counterLength / 2 + FRIDGE_WIDTH / 2;
    const counterTopY = COUNTER_HEIGHT;
    const counterCenterZ = -COUNTER_DEPTH / 2;

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
                <Box
                    args={[v.counterLength, COUNTER_HEIGHT, COUNTER_DEPTH]}
                    position={[0, COUNTER_HEIGHT / 2, -COUNTER_DEPTH / 2]}
                    castShadow receiveShadow
                >
                    <meshStandardMaterial color={v.counterColor} />
                </Box>
                {v.hasFridge && (
                    <Box
                        args={[FRIDGE_WIDTH, FRIDGE_HEIGHT, FRIDGE_DEPTH]}
                        position={[fridgePositionX, FRIDGE_HEIGHT / 2, -FRIDGE_DEPTH / 2]}
                        castShadow receiveShadow
                    >
                        <meshStandardMaterial color={v.fridgeColor} />
                    </Box>
                )}
                {v.hasMicrowave && (
                    <Box
                        args={[MICROWAVE_WIDTH, MICROWAVE_HEIGHT, MICROWAVE_DEPTH]}
                        position={[-v.counterLength / 2 + MICROWAVE_WIDTH / 2 + 0.2, counterTopY + MICROWAVE_HEIGHT / 2, counterCenterZ]}
                        castShadow receiveShadow
                    >
                        <meshStandardMaterial color={MICROWAVE_COLOR} />
                    </Box>
                )}
                {v.jugCount >= 1 && (
                    <Cylinder
                        args={[JUG_RADIUS, JUG_RADIUS, JUG_HEIGHT, 16]}
                        position={[-v.counterLength / 2 + 1.2, counterTopY + JUG_HEIGHT / 2, counterCenterZ]}
                        castShadow receiveShadow
                    >
                        <meshStandardMaterial color={JUG_COLOR} />
                    </Cylinder>
                )}
                {v.jugCount >= 2 && (
                    <Cylinder
                        args={[JUG_RADIUS, JUG_RADIUS, JUG_HEIGHT, 16]}
                        position={[0, counterTopY + JUG_HEIGHT / 2, counterCenterZ]}
                        castShadow receiveShadow
                    >
                        <meshStandardMaterial color={JUG_COLOR} />
                    </Cylinder>
                )}
            </group>
        </InteractiveObject>
    );
}
