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
 */

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { getOfficeTheme } from '@/config/office-theme';

function useOfficeSceneIsDarkMode(): boolean {
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const root = document.documentElement;
        const syncTheme = (): void => {
            setIsDarkMode(root.classList.contains('dark'));
        };

        syncTheme();

        const observer = new MutationObserver(() => {
            syncTheme();
        });

        observer.observe(root, { attributes: true, attributeFilter: ['class'] });
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

export function useOfficeSceneCameraTransition(params: {
    isBuilderMode: boolean;
    officeView2_5D: boolean;
    orbitControlsRef: React.RefObject<{
        object: THREE.Camera;
        update: () => void;
    } | null>;
    setAnimatingCamera: (value: boolean) => void;
}): void {
    const { isBuilderMode, officeView2_5D, orbitControlsRef, setAnimatingCamera } = params;

    useEffect(() => {
        const controls = orbitControlsRef.current;
        if (!controls) return;

        const camera = controls.object;
        const startPos = camera.position.clone();
        const endPos = officeView2_5D
            // Isometric-ish angle: corner facing camera
            ? new THREE.Vector3(30, 30, 30)
            : isBuilderMode
                ? new THREE.Vector3(0, 50, 0)
                : new THREE.Vector3(0, 25, 30);
        const duration = 500;
        const startTime = performance.now();

        const animateCamera = (): void => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);

            camera.position.lerpVectors(startPos, endPos, eased);
            camera.lookAt(0, 0, 0);
            camera.updateProjectionMatrix();
            controls.update();

            if (progress < 1) {
                requestAnimationFrame(animateCamera);
            } else {
                setAnimatingCamera(false);
            }
        };

        animateCamera();
    }, [isBuilderMode, officeView2_5D, orbitControlsRef, setAnimatingCamera]);
}
