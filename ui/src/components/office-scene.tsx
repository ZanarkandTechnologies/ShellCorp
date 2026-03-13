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
import { useAppStore } from "@/lib/app-store";
import { ViewComputerDialog } from "@/features/remote-cua-system/components/view-computer-dialog";
import { SceneContents } from "@/components/office-scene/scene-contents";
import {
  getInitialOfficeCameraConfig,
  useOfficeSceneBackground,
} from "@/components/office-scene/use-office-scene-camera";
import type { OfficeSceneProps } from "@/components/office-scene/types";

const OfficeScene = memo((props: OfficeSceneProps) => {
  const background = useOfficeSceneBackground(props.officeDecorSettings);
  const initialCameraConfig = getInitialOfficeCameraConfig(props.officeViewSettings);
  const viewComputerEmployeeId = useAppStore((state) => state.viewComputerEmployeeId);
  const viewComputerInitialProjectId = useAppStore((state) => state.viewComputerInitialProjectId);
  const setViewComputerEmployeeId = useAppStore((state) => state.setViewComputerEmployeeId);

  return (
    <>
      <Canvas
        key={initialCameraConfig.projection}
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

      {viewComputerEmployeeId ? (
        <ViewComputerDialog
          employeeId={viewComputerEmployeeId}
          open={Boolean(viewComputerEmployeeId)}
          onOpenChange={(open) => {
            if (!open) {
              setViewComputerEmployeeId(null);
            }
          }}
          initialProjectId={viewComputerInitialProjectId}
        />
      ) : null}
    </>
  );
});

OfficeScene.displayName = "OfficeScene";

export default OfficeScene;
export type { OfficeSceneProps };
