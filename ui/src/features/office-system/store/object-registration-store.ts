import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type * as THREE from 'three';

interface ObjectRegistrationState {
    // Map of object ID to Three.js Object3D reference
    registeredObjects: Map<string, THREE.Object3D>;

    // Actions
    registerObject: (id: string, object: THREE.Object3D) => void;
    unregisterObject: (id: string) => void;
    getObjects: () => THREE.Object3D[];
    reset: () => void;
}

export const useObjectRegistrationStore = create<ObjectRegistrationState>()(
    subscribeWithSelector((set, get) => ({
        registeredObjects: new Map(),

        registerObject: (id, object) => set((state) => {
            const newMap = new Map(state.registeredObjects);
            newMap.set(id, object);
            return { registeredObjects: newMap };
        }),

        unregisterObject: (id) => set((state) => {
            const newMap = new Map(state.registeredObjects);
            newMap.delete(id);
            return { registeredObjects: newMap };
        }),

        getObjects: () => Array.from(get().registeredObjects.values()),

        reset: () => set({ registeredObjects: new Map() }),
    }))
);

