import { Box } from "@react-three/drei";
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

export default function Couch({
    objectId,
    position,
    rotation,
    scale,
    companyId,
    metadata,
}: CouchProps) {
    const couchColor = "#4682B4";

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
            {/* Base */}
            <Box args={[2.5, 0.4, 1]} position={[0, 0.2, 0]} castShadow>
                <meshStandardMaterial color={couchColor} />
            </Box>
            {/* Back */}
            <Box args={[2.5, 0.6, 0.2]} position={[0, 0.7, -0.4]} castShadow>
                <meshStandardMaterial color={couchColor} />
            </Box>
            {/* Arms */}
            <Box args={[0.2, 0.3, 1]} position={[-1.15, 0.55, 0]} castShadow>
                <meshStandardMaterial color={couchColor} />
            </Box>
            <Box args={[0.2, 0.3, 1]} position={[1.15, 0.55, 0]} castShadow>
                <meshStandardMaterial color={couchColor} />
            </Box>
        </InteractiveObject>
    );
}