import { InteractiveObject } from './interactive-object';
import type { Id } from '@/convex/_generated/dataModel';

interface GlassWallProps {
    objectId: Id<"officeObjects">;
    position?: [number, number, number];
    rotation?: [number, number, number];
    companyId?: Id<"companies">;
    dimensions?: [number, number, number];
}

export default function GlassWall({
    objectId,
    position,
    rotation,
    companyId,
    dimensions = [4, 3, 0.25],
}: GlassWallProps) {
    return (
        <InteractiveObject
            objectType="glass-wall"
            objectId={objectId}
            companyId={companyId}
            initialPosition={position}
            initialRotation={rotation}
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