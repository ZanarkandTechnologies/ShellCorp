/**
 * OFFICE LIGHTING
 * ===============
 * Static office light rig for the 3D scene.
 *
 * KEY CONCEPTS:
 * - Lighting is presentation-only and should stay separate from scene bootstrap/data logic.
 *
 * USAGE:
 * - Render inside `SceneContents`.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 */

import type { getOfficeTheme } from "@/config/office-theme";
import { getOfficeLayoutBounds, type OfficeLayoutModel } from "@/lib/office-layout";
import type { OfficeSceneViewSettings } from "./view-profile";

export function OfficeLighting(props: {
  officeTheme: ReturnType<typeof getOfficeTheme>;
  officeLayout: OfficeLayoutModel;
  officeViewSettings: OfficeSceneViewSettings;
  sceneBuilderMode: boolean;
}): JSX.Element {
  const { officeTheme, officeLayout, officeViewSettings, sceneBuilderMode } = props;
  const bounds = getOfficeLayoutBounds(officeLayout);
  const isIsometricView = officeViewSettings.viewProfile === "fixed_2_5d";

  return (
    <>
      <ambientLight intensity={isIsometricView ? 1.15 : 0.9} color={officeTheme.lighting.ambient} />
      <directionalLight
        position={isIsometricView ? [18, 24, 18] : [0, 20, 5]}
        intensity={isIsometricView ? 1.15 : 1.5}
        color={officeTheme.lighting.directional}
        castShadow
        shadow-mapSize-width={sceneBuilderMode ? 1024 : 2048}
        shadow-mapSize-height={sceneBuilderMode ? 1024 : 2048}
        shadow-camera-far={50}
        shadow-camera-left={bounds.minWorldX - 5}
        shadow-camera-right={bounds.maxWorldX + 5}
        shadow-camera-top={bounds.maxWorldZ + 5}
        shadow-camera-bottom={bounds.minWorldZ - 5}
      />
      <pointLight
        position={[-10, 10, -10]}
        intensity={isIsometricView ? 0.3 : 0.5}
        color={officeTheme.lighting.point}
      />
      <pointLight
        position={[10, 10, 10]}
        intensity={isIsometricView ? 0.3 : 0.5}
        color={officeTheme.lighting.point}
      />
    </>
  );
}
