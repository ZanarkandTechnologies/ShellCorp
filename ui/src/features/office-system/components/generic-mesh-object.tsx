import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { InteractiveObject } from "./interactive-object";
import type { Id } from "@/convex/_generated/dataModel";
import * as THREE from "three";

interface GenericMeshObjectProps {
    url: string;
    objectId: Id<"officeObjects">;
    position: [number, number, number];
    rotation: [number, number, number];
    scale?: [number, number, number];
    companyId?: Id<"companies">;
    isDraggable?: boolean;
    isGhost?: boolean; // If true, renders without wrapper and with transparency
}

/**
 * GENERIC MESH OBJECT (Content Loader)
 * ====================================
 * 
 * Universal adapter for loading 3D content from GLTF/GLB files.
 * 
 * FEATURES:
 * - Dynamic loading of any GLTF/GLB url
 * - Instancing support (clones scene for multiple copies)
 * - Ghost mode (transparent blue preview for placement)
 * - Interactive wrapper (drag, select, context menu)
 * 
 * @example
 * // Ghost (placement preview):
 * <GenericMeshObject url="/chair.glb" isGhost={true} ... />
 * 
 * // Interactive object in scene:
 * <GenericMeshObject url="/chair.glb" objectId={id} companyId={company} ... />
 */
export function GenericMeshObject({
    url,
    objectId,
    position,
    rotation,
    scale = [1, 1, 1],
    companyId,
    isDraggable = true,
    isGhost = false
}: GenericMeshObjectProps) {
    const { scene } = useGLTF(url);

    // Clone the scene so we can have multiple independent instances of the same model
    const clonedScene = useMemo(() => {
        const clone = scene.clone(true);

        // If it's a ghost, apply transparent material override
        if (isGhost) {
            clone.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    // Clone material to avoid affecting other instances
                    if (Array.isArray(mesh.material)) {
                        mesh.material = mesh.material.map(m => m.clone());
                        mesh.material.forEach(m => {
                            m.transparent = true;
                            m.opacity = 0.5;
                            // Only set color if material has color property (MeshStandardMaterial, MeshBasicMaterial, etc.)
                            if ('color' in m && m.color instanceof THREE.Color) {
                                m.color.setHex(0x0000ff); // Blue tint
                            }
                        });
                    } else if (mesh.material) {
                        mesh.material = mesh.material.clone();
                        mesh.material.transparent = true;
                        mesh.material.opacity = 0.5;
                        // Only set color if material has color property (MeshStandardMaterial, MeshBasicMaterial, etc.)
                        if ('color' in mesh.material && mesh.material.color instanceof THREE.Color) {
                            mesh.material.color.setHex(0x0000ff);
                        }
                    }
                }
            });
        }
        return clone;
    }, [scene, isGhost]);

    const Model = <primitive object={clonedScene} scale={scale} />;

    if (isGhost) {
        return (
            <group position={position} rotation={rotation}>
                {Model}
            </group>
        );
    }

    return (
        <InteractiveObject
            objectType="furniture"
            objectId={objectId}
            companyId={companyId}
            initialPosition={position}
            initialRotation={rotation}
        >
            {Model}
        </InteractiveObject>
    );
}

