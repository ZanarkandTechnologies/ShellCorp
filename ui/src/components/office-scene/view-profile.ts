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
  minZoom?: number;
  maxZoom?: number;
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

/** Layout center for centering 2.5D camera on the office floor. */
export interface OfficeLayoutCenter {
  x: number;
  z: number;
}

export function getOfficeSceneViewState(params: {
  isBuilderMode: boolean;
  isDragging: boolean;
  settings: OfficeSceneViewSettings;
  forcePerspective?: boolean;
  layoutCenter?: OfficeLayoutCenter;
}): OfficeSceneViewState {
  const { isBuilderMode, isDragging, settings, forcePerspective = false, layoutCenter } = params;
  if (isBuilderMode) {
    return {
      cameraProjection: "perspective",
      cameraPosition: BUILDER_CAMERA_POSITION,
      cameraTarget: BUILDER_CAMERA_TARGET,
      cameraFov: 50,
      cameraZoom: 1,
      controlsEnabled: !isDragging,
      rotateEnabled: false,
      panEnabled: !isDragging,
      zoomEnabled: true,
      minPolarAngle: 0,
      maxPolarAngle: Math.PI / 3,
    };
  }

  if (isFixedOfficeSceneView(settings) && !forcePerspective) {
    const controlsEnabled = settings.orbitControlsEnabled && !isDragging;
    const basePos = getFixedViewCameraPosition(settings.cameraOrientation);
    const target: [number, number, number] = layoutCenter
      ? [layoutCenter.x, 0, layoutCenter.z]
      : [0, 0, 0];
    const position: [number, number, number] = layoutCenter
      ? [basePos[0] + layoutCenter.x, basePos[1], basePos[2] + layoutCenter.z]
      : basePos;
    return {
      cameraProjection: "orthographic",
      cameraPosition: position,
      cameraTarget: target,
      cameraFov: 35,
      cameraZoom: 28,
      minZoom: 12,
      maxZoom: 55,
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
