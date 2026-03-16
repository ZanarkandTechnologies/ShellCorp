"use client";

/**
 * OFFICE SCENE
 * ============
 * Public canvas shell for the 3D office experience.
 *
 * KEY CONCEPTS:
 * - This file stays thin and owns only the canvas shell plus external dialog mounting.
 * - Scene internals live under `components/office-scene/` so startup, rendering, and data shaping stay modular.
 *
 * USAGE:
 * - Render `OfficeScene` anywhere the office 3D experience should appear.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 * - MEM-0150
 */

import { memo } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { useChatStore } from "@/features/chat-system/chat-store";
import { useAppStore } from "@/lib/app-store";
import { SceneContents } from "@/components/office-scene/scene-contents";
import {
  getInitialOfficeCameraConfig,
  useOfficeSceneBackground,
} from "@/components/office-scene/use-office-scene-camera";
import type { OfficeSceneProps } from "@/components/office-scene/types";

const OfficeScene = memo((props: OfficeSceneProps) => {
  const background = useOfficeSceneBackground(props.officeDecorSettings);
  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const isChatOpen = useChatStore((state) => state.isChatOpen);
  const presentationMode = useChatStore((state) => state.presentationMode);
  const shouldForceBuilderPerspective =
    isBuilderMode && props.officeViewSettings.viewProfile === "fixed_2_5d";
  const forcePerspective =
    (isChatOpen && presentationMode === "story") || shouldForceBuilderPerspective;
  const initialCameraConfig = getInitialOfficeCameraConfig(props.officeViewSettings, {
    forcePerspective,
    isBuilderMode,
  });

  return (
    <Canvas
      key={`${initialCameraConfig.projection}-${forcePerspective ? "forced" : "normal"}`}
      shadows
      orthographic={initialCameraConfig.projection === "orthographic"}
      camera={{
        position: initialCameraConfig.position,
        fov: initialCameraConfig.fov,
        zoom: initialCameraConfig.zoom,
        near: 0.1,
        far: 1000,
      }}
      onCreated={({ camera }) => {
        camera.position.set(...initialCameraConfig.position);
        camera.lookAt(new THREE.Vector3(...initialCameraConfig.target));
        camera.updateProjectionMatrix();
      }}
      style={{ background, transition: "background 0.3s ease" }}
    >
      <SceneContents {...props} />
    </Canvas>
  );
});

OfficeScene.displayName = "OfficeScene";

export default OfficeScene;
export type { OfficeSceneProps };
