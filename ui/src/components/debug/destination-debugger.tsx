import { useEffect, useRef, memo } from 'react';
import * as THREE from 'three';
import { getActiveDestinations } from '@/features/nav-system/pathfinding/destination-registry';
import { useFrame } from '@react-three/fiber';

/**
 * DestinationDebugger - Shows active destination reservations
 * 
 * PERFORMANCE NOTES:
 * - Uses useRef instead of useState to avoid re-renders
 * - Updates positions directly via Three.js refs
 * - Only re-renders when destination count changes
 */
export const DestinationDebugger = memo(function DestinationDebugger({ visible = true }) {
    // Use refs to store destination data without causing re-renders
    const destinationsRef = useRef<Map<string, {
        position: THREE.Vector3;
        groupRef: THREE.Group | null;
    }>>(new Map());
    
    // Track destination count to trigger re-render only when needed
    const countRef = useRef(0);
    
    // Container group ref
    const containerRef = useRef<THREE.Group>(null);
    
    // Update destination positions in useFrame (no React re-renders)
    useFrame(() => {
        if (!visible) return;
        
        const active = getActiveDestinations();
        
        // Update existing positions directly via Three.js (no React state)
        for (const dest of active) {
            const existing = destinationsRef.current.get(dest.id);
            if (existing?.groupRef) {
                existing.groupRef.position.copy(dest.position);
                existing.position.copy(dest.position);
            }
        }
        
        // Only update React state if count changed (add/remove destinations)
        if (active.length !== countRef.current) {
            countRef.current = active.length;
            
            // Clear old data
            destinationsRef.current.clear();
            
            // Store new destinations
            for (const dest of active) {
                destinationsRef.current.set(dest.id, {
                    position: dest.position.clone(),
                    groupRef: null
                });
            }
            
            // Force re-render by updating container
            if (containerRef.current) {
                containerRef.current.userData.forceUpdate = Date.now();
            }
        }
    });
    
    // Initial load
    useEffect(() => {
        if (!visible) return;
        
        const active = getActiveDestinations();
        countRef.current = active.length;
        destinationsRef.current.clear();
        
        for (const dest of active) {
            destinationsRef.current.set(dest.id, {
                position: dest.position.clone(),
                groupRef: null
            });
        }
    }, [visible]);

    if (!visible) return null;

    // Get current destinations for rendering
    const destinations = Array.from(destinationsRef.current.entries());

    return (
        <group ref={containerRef}>
            {destinations.map(([id, data]) => (
                <group 
                    key={id} 
                    position={data.position}
                    ref={(ref) => {
                        if (ref && destinationsRef.current.has(id)) {
                            destinationsRef.current.get(id)!.groupRef = ref;
                        }
                    }}
                >
                    {/* Vertical pole */}
                    <mesh position={[0, 0.1, 0]}>
                        <boxGeometry args={[0.05, 1, 0.05]} />
                        <meshBasicMaterial color="red" transparent opacity={0.7} />
                    </mesh>

                    {/* Flag with employee ID */}
                    <mesh position={[0, 0.6, 0]} rotation={[0, Math.PI / 4, 0]}>
                        <boxGeometry args={[0.4, 0.2, 0.01]} />
                        <meshBasicMaterial color="white" transparent opacity={0.9} />
                    </mesh>

                    {/* Base circle */}
                    <mesh position={[0, -0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <circleGeometry args={[0.5, 16]} />
                        <meshBasicMaterial
                            color="red"
                            transparent
                            opacity={0.3}
                            side={THREE.DoubleSide}
                        />
                    </mesh>
                </group>
            ))}
        </group>
    );
}); 