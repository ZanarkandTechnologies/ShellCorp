import { useMemo, useRef } from "react";
import { getGridData } from "@/features/nav-system/pathfinding/a-star-pathfinding";
import * as THREE from "three";

interface NavMeshProps {
    visible: boolean;
    showPadding?: boolean; // New prop to toggle visualization of obstacle padding
}

export function NavMesh({ visible, showPadding = true }: NavMeshProps) {
    // Create geometry for the walkable areas
    const { walkableGrid, gridWidth, gridDepth, cellSize, worldOffsetX, worldOffsetZ } = getGridData();

    const { geometry, paddingGeometry } = useMemo(() => {
        if (!walkableGrid.length) {
            return { geometry: new THREE.BufferGeometry(), paddingGeometry: new THREE.BufferGeometry() };
        }

        // Grid for walkable areas (cells where walkableGrid is true)
        const walkableCells: { x: number; z: number }[] = [];

        // Track areas that might be padding (we'll determine these by comparing with neighbors)
        const possiblePaddingCells: { x: number; z: number }[] = [];

        // First pass - identify walkable and possible padding cells
        for (let x = 0; x < gridWidth; x++) {
            for (let z = 0; z < gridDepth; z++) {
                if (walkableGrid[x][z]) {
                    // This is a walkable cell
                    walkableCells.push({ x, z });
                } else {
                    // This is a non-walkable cell, check if it might be padding
                    // Consider it padding if at least one adjacent cell is walkable
                    let hasWalkableNeighbor = false;

                    // Check adjacent cells (up, down, left, right)
                    const neighbors = [
                        { x: x + 1, z },
                        { x: x - 1, z },
                        { x, z: z + 1 },
                        { x, z: z - 1 }
                    ];

                    for (const { x: nx, z: nz } of neighbors) {
                        if (nx >= 0 && nx < gridWidth && nz >= 0 && nz < gridDepth && walkableGrid[nx][nz]) {
                            hasWalkableNeighbor = true;
                            break;
                        }
                    }

                    if (hasWalkableNeighbor) {
                        possiblePaddingCells.push({ x, z });
                    }
                }
            }
        }

        // Create walkable geometry
        const walkableGeometry = new THREE.BufferGeometry();
        const vertices: number[] = [];

        // Create quad for each walkable cell
        for (const { x, z } of walkableCells) {
            const worldX = (x * cellSize) - worldOffsetX;
            const worldZ = (z * cellSize) - worldOffsetZ;

            // Create a slightly elevated quad for each cell
            // Bottom-left triangle
            vertices.push(worldX, 0.01, worldZ);
            vertices.push(worldX + cellSize, 0.01, worldZ);
            vertices.push(worldX, 0.01, worldZ + cellSize);

            // Top-right triangle
            vertices.push(worldX + cellSize, 0.01, worldZ);
            vertices.push(worldX + cellSize, 0.01, worldZ + cellSize);
            vertices.push(worldX, 0.01, worldZ + cellSize);
        }

        walkableGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        walkableGeometry.computeVertexNormals();

        // Create padding geometry (if enabled)
        const paddingVertices: number[] = [];

        // Create quad for each padding cell
        for (const { x, z } of possiblePaddingCells) {
            const worldX = (x * cellSize) - worldOffsetX;
            const worldZ = (z * cellSize) - worldOffsetZ;

            // Create a slightly elevated quad for each cell
            // Bottom-left triangle
            paddingVertices.push(worldX, 0.02, worldZ);
            paddingVertices.push(worldX + cellSize, 0.02, worldZ);
            paddingVertices.push(worldX, 0.02, worldZ + cellSize);

            // Top-right triangle
            paddingVertices.push(worldX + cellSize, 0.02, worldZ);
            paddingVertices.push(worldX + cellSize, 0.02, worldZ + cellSize);
            paddingVertices.push(worldX, 0.02, worldZ + cellSize);
        }

        const paddingBufferGeometry = new THREE.BufferGeometry();
        paddingBufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(paddingVertices, 3));
        paddingBufferGeometry.computeVertexNormals();

        return { geometry: walkableGeometry, paddingGeometry: paddingBufferGeometry };
    }, [walkableGrid, gridWidth, gridDepth, cellSize, worldOffsetX, worldOffsetZ]);

    if (!visible) return null;

    return (
        <>
            {/* Walkable areas */}
            <mesh geometry={geometry} receiveShadow={false}>
                <meshBasicMaterial
                    color="#00ff00"
                    transparent={true}
                    opacity={0.3}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>

            {/* Padding visualization (only if showPadding is true) */}
            {showPadding && (
                <mesh geometry={paddingGeometry} receiveShadow={false}>
                    <meshBasicMaterial
                        color="#ff6600"
                        transparent={true}
                        opacity={0.3}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                </mesh>
            )}
        </>
    );
} 