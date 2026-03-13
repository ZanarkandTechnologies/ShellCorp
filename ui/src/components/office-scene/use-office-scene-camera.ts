/**
 * OFFICE SCENE CAMERA
 * ===================
 * Encapsulates scene theme watching and builder camera transitions.
 *
 * KEY CONCEPTS:
 * - Theme observation and camera animation are scene-shell concerns, not render-tree concerns.
 * - Keeping this logic isolated prevents `office-scene.tsx` from growing with more startup/view state.
 *
 * USAGE:
 * - `useOfficeSceneBackground` in the outer canvas shell.
 * - `useOfficeSceneCameraTransition` in scene contents.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 * - MEM-0168
 */

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { getOfficeTheme } from "@/config/office-theme";
import type { OfficeSettingsModel } from "@/lib/openclaw-types";
import { getOfficeSceneViewState, type OfficeSceneViewSettings } from "./view-profile";

function useOfficeSceneIsDarkMode(): boolean {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const root = document.documentElement;
    const syncTheme = (): void => {
      setIsDarkMode(root.classList.contains("dark"));
    };

    syncTheme();

    const observer = new MutationObserver(() => {
      syncTheme();
    });

    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDarkMode;
}

export function useOfficeSceneBackground(): string {
  const isDarkMode = useOfficeSceneIsDarkMode();
  return useMemo(() => getOfficeTheme(isDarkMode).scene.background, [isDarkMode]);
}

export function useOfficeSceneTheme(): ReturnType<typeof getOfficeTheme> {
  const isDarkMode = useOfficeSceneIsDarkMode();
  return useMemo(() => getOfficeTheme(isDarkMode), [isDarkMode]);
}

export function getInitialOfficeCameraConfig(
  settings: Pick<OfficeSettingsModel, "viewProfile" | "orbitControlsEnabled" | "cameraOrientation">,
): {
  projection: "perspective" | "orthographic";
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  zoom: number;
} {
  const viewState = getOfficeSceneViewState({
    isBuilderMode: false,
    isDragging: false,
    settings,
  });
  return {
    projection: viewState.cameraProjection,
    position: viewState.cameraPosition,
    target: viewState.cameraTarget,
    fov: viewState.cameraFov,
    zoom: viewState.cameraZoom,
  };
}

export function useOfficeSceneCameraTransition(params: {
  isBuilderMode: boolean;
  settings: OfficeSceneViewSettings;
  orbitControlsRef: React.RefObject<{
    object: THREE.Camera;
    target: THREE.Vector3;
    update: () => void;
  } | null>;
  setAnimatingCamera: (value: boolean) => void;
}): void {
  const { isBuilderMode, settings, orbitControlsRef, setAnimatingCamera } = params;

  useEffect(() => {
    const controls = orbitControlsRef.current;
    if (!controls) return;

    const camera = controls.object;
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const nextViewState = getOfficeSceneViewState({
      isBuilderMode,
      isDragging: false,
      settings,
    });
    const endPos = new THREE.Vector3(...nextViewState.cameraPosition);
    const endTarget = new THREE.Vector3(...nextViewState.cameraTarget);
    if (
      startPos.distanceToSquared(endPos) < 0.0001 &&
      startTarget.distanceToSquared(endTarget) < 0.0001
    ) {
      setAnimatingCamera(false);
      return;
    }

    setAnimatingCamera(true);
    const duration = 500;
    const startTime = performance.now();

    const animateCamera = (): void => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      camera.position.lerpVectors(startPos, endPos, eased);
      controls.target.lerpVectors(startTarget, endTarget, eased);
      camera.lookAt(controls.target);
      camera.updateProjectionMatrix();
      controls.update();

      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      } else {
        setAnimatingCamera(false);
      }
    };

    animateCamera();
  }, [isBuilderMode, orbitControlsRef, setAnimatingCamera, settings]);
}
