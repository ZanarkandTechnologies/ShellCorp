import { Cylinder, Sphere } from "@react-three/drei";
import { useMemo } from "react";
import { InteractiveObject } from './interactive-object';
import type { Id } from "@/lib/entity-types";

interface PlantProps {
    objectId: Id<"officeObjects">;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
    companyId?: Id<"companies">;
    metadata?: Record<string, unknown>;
}

/** Variant shapes and colors so each catalog plant looks different */
function getPlantVariant(furnitureId: string | undefined) {
  switch (furnitureId) {
    case "plant-succulent":
      return { potRadius: 0.2, potColor: "#C4A574", foliageScale: [0.35, 0.35, 0.35] as [number, number, number], foliageY: 0.35, foliageColor: "#6B8E23", shape: "sphere" as const };
    case "plant-fern":
      return { potRadius: 0.28, potColor: "#654321", foliageScale: [0.7, 0.5, 0.7] as [number, number, number], foliageY: 0.6, foliageColor: "#2E8B57", shape: "wide" as const };
    case "plant-cactus":
      return { potRadius: 0.22, potColor: "#DEB887", foliageScale: [0.25, 0.9, 0.25] as [number, number, number], foliageY: 0.75, foliageColor: "#228B22", shape: "cylinder" as const };
    case "plant-palm":
      return { potRadius: 0.32, potColor: "#8B4513", foliageScale: [0.4, 0.4, 0.4] as [number, number, number], foliageY: 1.0, foliageColor: "#006400", shape: "sphere" as const };
    case "plant-monstera":
      return { potRadius: 0.3, potColor: "#5D4E37", foliageScale: [0.65, 0.5, 0.65] as [number, number, number], foliageY: 0.65, foliageColor: "#3CB371", shape: "wide" as const };
    case "misc-plant":
    case "misc-plant2":
      return { potRadius: 0.26, potColor: "#A0522D", foliageScale: [0.45, 0.45, 0.45] as [number, number, number], foliageY: 0.55, foliageColor: "#2F4F2F", shape: "sphere" as const };
    default:
      return { potRadius: 0.3, potColor: "#8B4513", foliageScale: [0.5, 0.5, 0.5] as [number, number, number], foliageY: 0.8, foliageColor: "#228B22", shape: "sphere" as const };
  }
}

export default function Plant({
    objectId,
    position,
    rotation,
    scale,
    companyId,
    metadata,
}: PlantProps) {
    const furnitureId = typeof metadata?.furnitureId === "string" ? metadata.furnitureId : undefined;
    const variant = useMemo(() => getPlantVariant(furnitureId), [furnitureId]);
    const potHeight = 0.5;

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
                <Cylinder args={[variant.potRadius * 0.9, variant.potRadius, potHeight, 16]} position={[0, potHeight / 2, 0]} castShadow>
                    <meshStandardMaterial color={variant.potColor} />
                </Cylinder>
                {variant.shape === "sphere" && (
                    <Sphere args={[0.5, 16, 16]} position={[0, potHeight + variant.foliageY * 0.5, 0]} scale={variant.foliageScale} castShadow>
                        <meshStandardMaterial color={variant.foliageColor} />
                    </Sphere>
                )}
                {variant.shape === "wide" && (
                    <Sphere args={[0.5, 16, 16]} position={[0, potHeight + variant.foliageY * 0.5, 0]} scale={variant.foliageScale} castShadow>
                        <meshStandardMaterial color={variant.foliageColor} />
                    </Sphere>
                )}
                {variant.shape === "cylinder" && (
                    <Cylinder args={[0.2, 0.22, 0.9, 8]} position={[0, potHeight + 0.45, 0]} castShadow>
                        <meshStandardMaterial color={variant.foliageColor} />
                    </Cylinder>
                )}
            </group>
        </InteractiveObject>
    );
}
