import { useMemo, memo } from "react";
import * as THREE from 'three';
import { Line } from "@react-three/drei";

// Separate component for path visualization in world space
// Memoized to prevent unnecessary re-renders
const PathVisualizer = memo(function PathVisualizer({
    originalPath,
    remainingPath,
    isGoingToDesk,
}: {
    originalPath: THREE.Vector3[] | null,
    remainingPath: THREE.Vector3[] | null,
    isGoingToDesk: boolean,
    employeeId: string
}) {
    // Path colors and materials
    const pathSettings = useMemo(() => {
        // Base colors
        const baseColor = isGoingToDesk ? '#0099ff' : '#ff00ff';

        return {
            original: {
                color: baseColor,
                opacity: 0.3,
                dashed: true,
                dashSize: 0.1,
                gapSize: 0.1,
                lineWidth: 0.1
            },
            current: {
                color: baseColor,
                opacity: 1.0,
                dashed: false,
                lineWidth: 0.1
            },
            destination: {
                color: baseColor,
                opacity: 1.0,
                radius: 0.3
            }
        };
    }, [isGoingToDesk]);

    // Get destination point (last point in path)
    const destinationPoint = useMemo(() => {
        if (remainingPath && remainingPath.length > 1) {
            return remainingPath[remainingPath.length - 1];
        }
        return null;
    }, [remainingPath]);

    // Skip rendering if no paths
    if ((!originalPath || originalPath.length < 2) &&
        (!remainingPath || remainingPath.length < 2)) {
        return null;
    }

    return (
        <>
            {/* Original planned path (faded) */}
            {/* {originalPath && originalPath.length > 1 && (
                <Line
                    points={originalPath}
                    color={pathSettings.original.color}
                    lineWidth={pathSettings.original.lineWidth}
                    dashed={pathSettings.original.dashed}
                    dashSize={pathSettings.original.dashSize}
                    gapSize={pathSettings.original.gapSize}
                    worldUnits
                >
                    <lineBasicMaterial
                        transparent
                        opacity={pathSettings.original.opacity}
                        depthTest={false}
                    />
                </Line>
            )} */}

            {/* Remaining path (bright) */}
            {remainingPath && remainingPath.length > 1 && (
                <Line
                    points={remainingPath}
                    color={pathSettings.current.color}
                    lineWidth={pathSettings.current.lineWidth}
                    dashed={pathSettings.current.dashed}
                    worldUnits
                >
                    <lineBasicMaterial
                        transparent
                        opacity={pathSettings.current.opacity}
                        depthTest={false}
                    />
                </Line>
            )}

            {/* Destination Circle */}
            {destinationPoint && (
                <mesh position={destinationPoint} rotation={[Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[pathSettings.destination.radius, 32]} />
                    <meshBasicMaterial
                        color={pathSettings.destination.color}
                        transparent
                        opacity={pathSettings.destination.opacity}
                        depthTest={false}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}
        </>
    );
});

export default PathVisualizer;