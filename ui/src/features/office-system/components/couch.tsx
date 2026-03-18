import { Box } from "@react-three/drei";
import { useMemo } from "react";
import { InteractiveObject } from './interactive-object';
import type { Id } from "@/lib/entity-types";

interface CouchProps {
    objectId: Id<"officeObjects">;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
    companyId?: Id<"companies">;
    metadata?: Record<string, unknown>;
}

/** Variant colors and dimensions so each catalog couch looks different */
function getCouchVariant(furnitureId: string | undefined) {
  switch (furnitureId) {
    case "couch-sofa":
      return { color: "#708090", width: 2.6, height: 0.45, backHeight: 0.65, armHeight: 0.35 };
    case "couch-beanbag":
      return { color: "#CD853F", width: 1.4, height: 0.5, backHeight: 0.3, armHeight: 0 };
    case "couch-armchair":
      return { color: "#4682B4", width: 1.1, height: 0.42, backHeight: 0.7, armHeight: 0.4 };
    case "couch-ottoman":
      return { color: "#8B7355", width: 1.2, height: 0.35, backHeight: 0, armHeight: 0 };
    case "couch-loveseat":
      return { color: "#556B2F", width: 1.8, height: 0.4, backHeight: 0.6, armHeight: 0.32 };
    case "misc-couch":
      return { color: "#B8860B", width: 1.5, height: 0.38, backHeight: 0.55, armHeight: 0.28 };
    default:
      return { color: "#4682B4", width: 2.5, height: 0.4, backHeight: 0.6, armHeight: 0.3 };
  }
}

export default function Couch({
    objectId,
    position,
    rotation,
    scale,
    companyId,
    metadata,
}: CouchProps) {
    const furnitureId = typeof metadata?.furnitureId === "string" ? metadata.furnitureId : undefined;
    const v = useMemo(() => getCouchVariant(furnitureId), [furnitureId]);
    const depth = 1;
    const hasArms = v.armHeight > 0;
    const hasBack = v.backHeight > 0;

    return (
        <InteractiveObject
            objectType="couch"
            objectId={objectId}
            companyId={companyId}
            initialPosition={position}
            initialRotation={rotation}
            initialScale={scale}
            metadata={metadata}
        >
            <group>
                <Box args={[v.width, v.height, depth]} position={[0, v.height / 2, 0]} castShadow>
                    <meshStandardMaterial color={v.color} />
                </Box>
                {hasBack && (
                    <Box args={[v.width, v.backHeight, 0.2]} position={[0, v.height + v.backHeight / 2, -depth / 2 + 0.1]} castShadow>
                        <meshStandardMaterial color={v.color} />
                    </Box>
                )}
                {hasArms && (
                    <>
                        <Box args={[0.2, v.armHeight, depth]} position={[-v.width / 2 + 0.1, v.height / 2 + v.armHeight / 2, 0]} castShadow>
                            <meshStandardMaterial color={v.color} />
                        </Box>
                        <Box args={[0.2, v.armHeight, depth]} position={[v.width / 2 - 0.1, v.height / 2 + v.armHeight / 2, 0]} castShadow>
                            <meshStandardMaterial color={v.color} />
                        </Box>
                    </>
                )}
            </group>
        </InteractiveObject>
    );
}
