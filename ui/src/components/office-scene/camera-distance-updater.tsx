/**
 * Updates app store with current camera distance from orbit target (for wall opacity).
 */
import { useFrame } from '@react-three/fiber';
import { useAppStore } from '@/lib/app-store';
import type * as THREE from 'three';

export function CameraDistanceUpdater(props: {
    controlsRef: React.RefObject<{ object: THREE.Camera; target: THREE.Vector3 } | null>;
}): null {
    const setCameraDistance = useAppStore((s) => s.setCameraDistance);

    useFrame(() => {
        const c = props.controlsRef.current;
        if (!c?.object) return;
        const d = c.object.position.distanceTo(c.target);
        setCameraDistance(d);
    });

    return null;
}
