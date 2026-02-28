import { useEffect, useMemo, useState } from "react";
import { Box } from "@react-three/drei";
import * as THREE from "three";
import { InteractiveObject } from "./interactive-object";
import type { Id } from "@/convex/_generated/dataModel";
import {
  type CachedMesh,
  getMesh,
  preloadMesh,
  cloneCachedScene,
} from "../systems/mesh-cache";

interface CustomMeshObjectProps {
  objectId: Id<"officeObjects">;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  companyId?: Id<"companies">;
  meshUrl: string;
  label?: string;
}

export default function CustomMeshObject({
  objectId,
  position,
  rotation,
  scale,
  companyId,
  meshUrl,
  label,
}: CustomMeshObjectProps) {
  const [cachedMesh, setCachedMesh] = useState<CachedMesh | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCachedMesh(null);
    setLoadError(false);
    if (!meshUrl) {
      setLoadError(true);
      return () => {};
    }

    const existing = getMesh(meshUrl);
    if (existing?.status === "loaded") {
      setCachedMesh(existing.mesh);
      return () => {};
    }
    if (existing?.status === "error") {
      setLoadError(true);
      return () => {};
    }

    preloadMesh(meshUrl)
      .then((mesh) => {
        if (!cancelled) setCachedMesh(mesh);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [meshUrl]);

  const clonedScene = useMemo(() => {
    if (!cachedMesh) return null;
    return cloneCachedScene(cachedMesh);
  }, [cachedMesh]);

  const meshScale = useMemo<[number, number, number]>(() => {
    if (!scale || scale.length !== 3) return [1, 1, 1];
    return scale;
  }, [scale]);

  const groundOffset = cachedMesh?.groundOffset ?? 0;

  return (
    <InteractiveObject
      objectType="custom-mesh"
      objectId={objectId}
      companyId={companyId}
      initialPosition={position}
      initialRotation={rotation}
    >
      {clonedScene ? (
        <primitive object={clonedScene} scale={meshScale} position={[0, groundOffset, 0]} />
      ) : (
        <group>
          <Box args={[1.5, 1.5, 1.5]} position={[0, 0.75, 0]} castShadow receiveShadow scale={meshScale}>
            <meshStandardMaterial color={loadError ? "#ef4444" : "#94a3b8"} transparent opacity={0.85} />
          </Box>
          <mesh position={[0, 1.8, 0]}>
            <boxGeometry args={[1.8, 0.2, 0.2]} />
            <meshStandardMaterial color={loadError ? "#ef4444" : "#f59e0b"} />
          </mesh>
        </group>
      )}
      {label ? <group name={`custom-mesh-${label}`} /> : null}
    </InteractiveObject>
  );
}
