/**
 * OFFICE SCENE VIEW PROFILE
 * =========================
 * Resolves camera presets, control policies, and non-destructive 2.5D presentation overrides.
 *
 * KEY CONCEPTS:
 * - View switching is settings-backed and must survive reloads.
 * - Fixed 2.5D changes presentation only; it must not mutate persisted office-object transforms.
 *
 * USAGE:
 * - Use `getOfficeSceneViewState()` to drive camera position, target, and OrbitControls flags.
 * - Use `getOfficePresentationRotationY()` when a mesh should face the active 2.5D viewpoint.
 *
 * MEMORY REFERENCES:
 * - MEM-0168
 */

import type { OfficeSettingsModel } from "@/lib/openclaw-types";

export type OfficeSceneViewSettings = Pick<
  OfficeSettingsModel,
  "viewProfile" | "orbitControlsEnabled" | "cameraOrientation"
>;

export function isFixedOfficeSceneView(settings: OfficeSceneViewSettings): boolean {
  return settings.viewProfile === "fixed_2_5d";
}

export interface OfficeSceneViewState {
  cameraProjection: "perspective" | "orthographic";
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  cameraFov: number;
  cameraZoom: number;
  controlsEnabled: boolean;
  rotateEnabled: boolean;
  panEnabled: boolean;
  zoomEnabled: boolean;
  minPolarAngle: number;
  maxPolarAngle: number;
}

const FREE_ORBIT_CAMERA_POSITION: [number, number, number] = [0, 25, 30];
const FREE_ORBIT_CAMERA_TARGET: [number, number, number] = [0, 0, 0];
const BUILDER_CAMERA_POSITION: [number, number, number] = [0, 50, 0];
const BUILDER_CAMERA_TARGET: [number, number, number] = [0, 0, 0];

function getFixedViewCameraPosition(
  orientation: OfficeSceneViewSettings["cameraOrientation"],
): [number, number, number] {
  switch (orientation) {
    case "north_east":
      return [26, 18, -26];
    case "north_west":
      return [-26, 18, -26];
    case "south_west":
      return [-26, 18, 26];
    default:
      return [26, 18, 26];
  }
}

export function getOfficePresentationRotationY(
  orientation: OfficeSceneViewSettings["cameraOrientation"],
): number {
  const [x, , z] = getFixedViewCameraPosition(orientation);
  return Math.atan2(x, z);
}

export function getOfficeSceneViewState(params: {
  isBuilderMode: boolean;
  isDragging: boolean;
  settings: OfficeSceneViewSettings;
  forcePerspective?: boolean;
}): OfficeSceneViewState {
  const { isBuilderMode, isDragging, settings, forcePerspective = false } = params;
  if (isBuilderMode) {
    return {
      cameraProjection:
        settings.viewProfile === "fixed_2_5d" && !forcePerspective ? "orthographic" : "perspective",
      cameraPosition: BUILDER_CAMERA_POSITION,
      cameraTarget: BUILDER_CAMERA_TARGET,
      cameraFov: 50,
      cameraZoom: 28,
      controlsEnabled: !isDragging,
      rotateEnabled: !isDragging,
      panEnabled: !isDragging,
      zoomEnabled: true,
      minPolarAngle: 0,
      maxPolarAngle: Math.PI / 3,
    };
  }

  if (isFixedOfficeSceneView(settings) && !forcePerspective) {
    const controlsEnabled = settings.orbitControlsEnabled && !isDragging;
    return {
      cameraProjection: "orthographic",
      cameraPosition: getFixedViewCameraPosition(settings.cameraOrientation),
      cameraTarget: [0, 0, 0],
      cameraFov: 35,
      cameraZoom: 28,
      controlsEnabled,
      rotateEnabled: false,
      panEnabled: controlsEnabled,
      zoomEnabled: true,
      minPolarAngle: 0,
      maxPolarAngle: Math.PI,
    };
  }

  const controlsEnabled = settings.orbitControlsEnabled && !isDragging;
  return {
    cameraProjection: "perspective",
    cameraPosition: FREE_ORBIT_CAMERA_POSITION,
    cameraTarget: FREE_ORBIT_CAMERA_TARGET,
    cameraFov: 50,
    cameraZoom: 1,
    controlsEnabled,
    rotateEnabled: controlsEnabled,
    panEnabled: controlsEnabled,
    zoomEnabled: true,
    minPolarAngle: 0,
    maxPolarAngle: Math.PI,
  };
}
