/**
 * OFFICE SCENE BOOTSTRAP
 * ======================
 * Ref and initialization wiring for office objects, CEO desk registration, and nav-grid startup.
 *
 * KEY CONCEPTS:
 * - Scene bootstrap is coordinated once here instead of being scattered through render branches.
 * - New startup phases should expose one readiness signal rather than introducing local loaders.
 *
 * USAGE:
 * - Call from `scene-contents.tsx`.
 * - Pass `createRegisteredObjectRef` into object renderer components.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 * - MEM-0150
 */

import { createRef, useCallback, useEffect, useRef } from 'react';
import type { OrbitControls } from '@react-three/drei';
import type * as THREE from 'three';
import { useObjectRegistrationStore } from '@/features/office-system/store/object-registration-store';
import { initializeGrid } from '@/features/nav-system/pathfinding/a-star-pathfinding';
import type { OfficeLayoutModel } from '@/lib/office-layout';

export function useOfficeSceneBootstrap(params: {
    officeLayout: OfficeLayoutModel;
    officeObjectCount: number;
    hasCeoDesk: boolean;
    onNavigationReady?: () => void;
}): {
    orbitControlsRef: React.RefObject<React.ElementRef<typeof OrbitControls> | null>;
    floorRef: React.RefObject<THREE.Mesh | null>;
    ceoDeskRef: React.RefObject<THREE.Group | null>;
    createRegisteredObjectRef: (
        objectId: string,
        objectRef: React.MutableRefObject<THREE.Group | null>,
    ) => (element: THREE.Group | null) => void;
    getObjectRef: (objectId: string) => React.RefObject<THREE.Group | null>;
} {
    const { officeLayout, officeObjectCount, hasCeoDesk, onNavigationReady } = params;
    const orbitControlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null);
    const floorRef = useRef<THREE.Mesh>(null);
    const ceoDeskRef = useRef<THREE.Group>(null);
    const officeObjectRefs = useRef<Map<string, React.RefObject<THREE.Group | null>>>(new Map());

    const registerObject = useObjectRegistrationStore((state) => state.registerObject);
    const unregisterObject = useObjectRegistrationStore((state) => state.unregisterObject);
    const getObjects = useObjectRegistrationStore((state) => state.getObjects);
    const registeredObjectCount = useObjectRegistrationStore((state) => state.registeredObjects.size);

    const getObjectRef = useCallback((objectId: string) => {
        if (!officeObjectRefs.current.has(objectId)) {
            officeObjectRefs.current.set(objectId, createRef<THREE.Group>());
        }
        return officeObjectRefs.current.get(objectId)!;
    }, []);

    const createRegisteredObjectRef = useCallback(
        (objectId: string, objectRef: React.MutableRefObject<THREE.Group | null>) => {
            return (element: THREE.Group | null) => {
                objectRef.current = element;
                if (element) {
                    registerObject(objectId, element);
                } else {
                    unregisterObject(objectId);
                }
            };
        },
        [registerObject, unregisterObject],
    );

    useEffect(() => {
        if (ceoDeskRef.current) {
            registerObject('ceo-desk', ceoDeskRef.current);
        }
        return () => unregisterObject('ceo-desk');
    }, [registerObject, unregisterObject]);

    useEffect(() => {
        const timer = setTimeout(() => {
            const objects = getObjects();
            const expectedCount = officeObjectCount + (hasCeoDesk ? 1 : 0);

            if (expectedCount > 0 && objects.length > 0) {
                initializeGrid(officeLayout, objects, 2, 3);
                onNavigationReady?.();
            } else if (expectedCount === 0) {
                initializeGrid(officeLayout, [], 2, 3);
                onNavigationReady?.();
            } else {
                // Architecture seam:
                // registration can trail initial render by a tick. This effect intentionally
                // re-runs on registration-count changes so future scene bootstrap phases can
                // compose through the same readiness model instead of adding bespoke retry loops.
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [getObjects, hasCeoDesk, officeLayout, officeObjectCount, onNavigationReady, registeredObjectCount]);

    return {
        orbitControlsRef,
        floorRef,
        ceoDeskRef,
        createRegisteredObjectRef,
        getObjectRef,
    };
}
