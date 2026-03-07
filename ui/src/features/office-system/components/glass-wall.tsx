import { InteractiveObject } from './interactive-object';
import type { Id } from "@/lib/entity-types";

interface GlassWallProps {
    objectId: Id<"officeObjects">;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
    companyId?: Id<"companies">;
    dimensions?: [number, number, number];
    metadata?: Record<string, unknown>;
}

export default function GlassWall({
    objectId,
    position,
    rotation,
    scale,
    companyId,
    dimensions = [4, 3, 0.25],
    metadata,
}: GlassWallProps) {
    return (
        <InteractiveObject
            objectType="glass-wall"
            objectId={objectId}
            companyId={companyId}
            initialPosition={position}
            initialRotation={rotation}
            initialScale={scale}
            metadata={metadata}
        >
            <mesh position={[0, dimensions[1] / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={dimensions} />
                <meshStandardMaterial
                    color="lightblue"
                    opacity={0.3}
                    transparent
                    depthWrite={false}
                />
            </mesh>
        </InteractiveObject>
    );
}