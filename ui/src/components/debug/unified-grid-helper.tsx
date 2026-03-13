/**
 * UNIFIED GRID HELPER
 * ===================
 * Shared scene overlay for builder and nav debug grids.
 *
 * KEY CONCEPTS:
 * - Builder mode must align 1:1 with office layout tiles rather than nav cells.
 * - Debug walkability overlays still derive from the A* grid.
 *
 * USAGE:
 * - Render through `SmartGrid` from `SceneContents`.
 *
 * MEMORY REFERENCES:
 * - MEM-0172
 * - MEM-0173
 */

'use client';

import { Box } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { getBuilderGridLinePositions } from '@/components/debug/builder-grid';
import { getGridData } from '@/features/nav-system/pathfinding/a-star-pathfinding';
import { getOfficeLayoutBounds } from '@/lib/office-layout';
import { useOfficeDataContext } from '@/providers/office-data-provider';

const DEBUG_COLOR = 0xff0000;
const BUILDER_COLOR = 0x0000ff;
const BOTH_COLOR = 0x9932cc;

interface GridCellVisual {
  key: string;
  position: THREE.Vector3Tuple;
  color: string;
  isWalkable: boolean;
}

interface UnifiedGridHelperProps {
  mode: 'debug' | 'builder' | 'both';
}

const UnifiedGridHelper = memo(function UnifiedGridHelper({ mode }: UnifiedGridHelperProps) {
  const { scene } = useThree();
  const { officeSettings } = useOfficeDataContext();
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const [gridVisualData, setGridVisualData] = useState<GridCellVisual[]>([]);
  const layoutBounds = useMemo(
    () => getOfficeLayoutBounds(officeSettings.officeLayout),
    [officeSettings.officeLayout],
  );
  const builderGridPositions = useMemo(
    () => (mode === 'debug' ? null : getBuilderGridLinePositions(layoutBounds)),
    [layoutBounds, mode],
  );

  useEffect(() => {
    const gridData = getGridData();
    if (mode !== 'debug') {
      if (gridRef.current) {
        scene.remove(gridRef.current);
        gridRef.current.dispose();
        gridRef.current = null;
      }
      return;
    }

    if (gridData.cellSize === 0) {
      console.warn('Grid not initialized, UnifiedGridHelper cannot render.');
      return;
    }

    const gridCellSize = gridData.cellSize;
    const size = gridData.gridWidth * gridData.cellSize;
    const divisions = Math.max(1, Math.round(size / gridCellSize));

    const newGrid = new THREE.GridHelper(size, divisions, DEBUG_COLOR, DEBUG_COLOR);
    newGrid.position.set(layoutBounds.centerX, 0.01, layoutBounds.centerZ);

    if (gridRef.current) {
      scene.remove(gridRef.current);
      gridRef.current.dispose();
    }

    scene.add(newGrid);
    gridRef.current = newGrid;

    return () => {
      scene.remove(newGrid);
      newGrid.dispose();
    };
  }, [layoutBounds.centerX, layoutBounds.centerZ, mode, scene]);

  useEffect(() => {
    const shouldShowWalkableCells = mode === 'debug' || mode === 'both';
    if (!shouldShowWalkableCells) {
      setGridVisualData([]);
      return;
    }

    const { gridWidth, gridDepth, cellSize, worldOffsetX, worldOffsetZ, walkableGrid } = getGridData();
    if (!walkableGrid.length) {
      setGridVisualData([]);
      return;
    }

    const visuals: GridCellVisual[] = [];
    const gridYPosition = 0.02;

    for (let x = 0; x < gridWidth; x += 1) {
      for (let z = 0; z < gridDepth; z += 1) {
        const isWalkable = walkableGrid[x][z];
        const worldX = x * cellSize - worldOffsetX + cellSize / 2;
        const worldZ = z * cellSize - worldOffsetZ + cellSize / 2;
        visuals.push({
          key: `${x}-${z}`,
          position: [worldX, gridYPosition, worldZ],
          color: isWalkable ? 'lightgreen' : 'salmon',
          isWalkable,
        });
      }
    }

    setGridVisualData(visuals);
  }, [mode]);

  const { cellSize } = getGridData();

  return (
    <group name="unifiedGridHelper">
      {builderGridPositions ? (
        <lineSegments name="builderTileGrid">
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={builderGridPositions}
              count={builderGridPositions.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color={mode === 'both' ? BOTH_COLOR : BUILDER_COLOR}
            transparent
            opacity={0.85}
          />
        </lineSegments>
      ) : null}
      {gridVisualData.length > 0 ? (
        <group name="walkablePathVisualization">
          {gridVisualData.map((cell) => (
            <Box
              key={cell.key}
              args={[cellSize * 0.9, 0.01, cellSize * 0.9]}
              position={cell.position}
            >
              <meshBasicMaterial
                color={cell.color}
                opacity={cell.isWalkable ? 0.2 : 0.4}
                transparent
                depthWrite={false}
              />
            </Box>
          ))}
        </group>
      ) : null}
    </group>
  );
});

interface SmartGridProps {
  debugMode: boolean;
  isBuilderMode: boolean;
  placementActive?: boolean;
}

export const SmartGrid = memo(function SmartGrid({ debugMode, isBuilderMode, placementActive }: SmartGridProps) {
  if (!debugMode && !isBuilderMode && !placementActive) return null;

  let gridMode: 'debug' | 'builder' | 'both';
  if (debugMode && (isBuilderMode || placementActive)) {
    gridMode = 'both';
  } else if (debugMode) {
    gridMode = 'debug';
  } else {
    gridMode = 'builder';
  }

  return <UnifiedGridHelper mode={gridMode} />;
});
