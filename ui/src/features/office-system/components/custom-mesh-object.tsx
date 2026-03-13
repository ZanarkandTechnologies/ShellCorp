import { useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@react-three/drei";
import * as THREE from "three";
import { InteractiveObject } from "./interactive-object";
import type { Id } from "@/lib/entity-types";
import {
  type CachedMesh,
  getMesh,
  preloadMesh,
  cloneCachedScene,
} from "../systems/mesh-cache";
import { deriveCustomMeshInteractionBounds } from "./custom-mesh-interaction";
import { formatMeshDiagnosticsSummary } from "../systems/mesh-diagnostics";

interface CustomMeshObjectProps {
  objectId: Id<"officeObjects">;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  companyId?: Id<"companies">;
  meshUrl: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

export default function CustomMeshObject({
  objectId,
  position,
  rotation,
  scale,
  companyId,
  meshUrl,
  label,
  metadata,
}: CustomMeshObjectProps) {
  const [cachedMesh, setCachedMesh] = useState<CachedMesh | null>(null);
  const [loadError, setLoadError] = useState(false);
  const warnedRuntimeGuardrailRef = useRef(false);
  const runtimePanelUrl =
    metadata &&
    typeof metadata.uiBinding === "object" &&
    metadata.uiBinding !== null &&
    "kind" in metadata.uiBinding &&
    metadata.uiBinding.kind === "embed" &&
    "url" in metadata.uiBinding &&
    typeof metadata.uiBinding.url === "string"
      ? metadata.uiBinding.url
      : null;

  useEffect(() => {
    let cancelled = false;
    warnedRuntimeGuardrailRef.current = false;
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
    const scene = cloneCachedScene(cachedMesh);
    scene.traverse((child) => {
      if ("isMesh" in child && child.isMesh) {
        child.raycast = () => null;
      }
    });
    return scene;
  }, [cachedMesh]);

  const groundOffset = cachedMesh?.groundOffset ?? 0;
  const interactionBounds = useMemo(() => {
    if (!cachedMesh) return undefined;
    return deriveCustomMeshInteractionBounds(cachedMesh.boundingBox.clone(), groundOffset);
  }, [cachedMesh, groundOffset]);

  useEffect(() => {
    if (!import.meta.env.DEV || !cachedMesh || !runtimePanelUrl) {
      return;
    }

    if (cachedMesh.diagnostics.warnings.length === 0 || warnedRuntimeGuardrailRef.current) {
      return;
    }

    warnedRuntimeGuardrailRef.current = true;
    console.warn("[office-object] runtime panel mesh guardrail", {
      objectId: String(objectId),
      label,
      meshUrl,
      runtimePanelUrl,
      interactionBounds,
      summary: formatMeshDiagnosticsSummary(cachedMesh.diagnostics),
      diagnostics: cachedMesh.diagnostics,
    });
  }, [cachedMesh, interactionBounds, label, meshUrl, objectId, runtimePanelUrl]);

  return (
    <InteractiveObject
      objectType="custom-mesh"
      objectId={objectId}
      companyId={companyId}
      initialPosition={position}
      initialRotation={rotation}
      initialScale={scale}
      metadata={metadata}
      interactionBounds={interactionBounds}
    >
      {clonedScene ? (
        <primitive object={clonedScene} position={[0, groundOffset, 0]} />
      ) : (
        <group>
          <Box args={[1.5, 1.5, 1.5]} position={[0, 0.75, 0]} castShadow receiveShadow>
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
