import { useEffect, useRef, useState, useCallback } from 'react';
import { useFrame, ThreeEvent, useThree } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '@/lib/app-store';
import type { OfficeId } from '@/lib/types';
import { gatewayBase, stateBase } from '@/lib/gateway-config';
import { OpenClawAdapter } from '@/lib/openclaw-adapter';
import { ContextMenu, MenuAction } from './context-menu';
import { Move, RotateCw, RotateCcw, Trash2, Settings } from 'lucide-react';
import { DraggableController } from '../controllers/draggable-controller';

interface InteractiveObjectProps {
    children: React.ReactNode;

    // Database
    objectId: OfficeId<"officeObjects">;
    objectType: string; // e.g., "plant", "couch", "team-cluster"
    companyId?: OfficeId<"companies">;

    // Transform
    initialPosition?: [number, number, number];
    initialRotation?: [number, number, number];

    // Optional customization
    showHoverEffect?: boolean;
    customActions?: MenuAction[];
    onSettings?: () => void;
}

/**
 * INTERACTIVE OBJECT - Unified Component
 * ======================================
 * 
 * All-in-one component for selectable, draggable 3D objects in the office scene.
 * 
 * FEATURES:
 * - Click to select/deselect (shows context menu)
 * - Hover effects
 * - Drag-and-drop in builder mode
 * - Database sync (position, rotation, delete)
 * - Optimistic updates
 * 
 * ARCHITECTURE:
 * - Uses DraggableController class for drag logic (testable, reusable)
 * - Single component instead of wrapper hierarchy
 * - One ref, one source of truth
 * 
 * @example
 * ```tsx
 * <InteractiveObject
 *   objectId={obj._id}
 *   objectType="plant"
 *   companyId={companyId}
 *   initialPosition={[0, 0, 0]}
 * >
 *   <PlantMesh />
 * </InteractiveObject>
 * ```
 */
export function InteractiveObject({
    children,
    objectId,
    objectType,
    companyId,
    initialPosition = [0, 0, 0],
    initialRotation = [0, 0, 0],
    showHoverEffect = true,
    customActions,
    onSettings,
}: InteractiveObjectProps) {
    const groupRef = useRef<THREE.Group>(null);
    const controllerRef = useRef<DraggableController | null>(null);
    const { camera, gl } = useThree();
    const adapterRef = useRef<OpenClawAdapter>(new OpenClawAdapter(gatewayBase, stateBase));

    // Local state for optimistic updates
    const [localPosition, setLocalPosition] = useState<[number, number, number]>(initialPosition);
    const [localRotation, setLocalRotation] = useState<[number, number, number]>(initialRotation);
    const [isHovered, setIsHovered] = useState(false);
    const [isLocallyDragging, setIsLocallyDragging] = useState(false);

    // Global state
    const isBuilderMode = useAppStore(state => state.isBuilderMode);
    const isDragEnabled = isBuilderMode && !!companyId;
    const setGlobalDragging = useAppStore(state => state.setIsDragging);
    const selectedObjectId = useAppStore(state => state.selectedObjectId);
    const setSelectedObjectId = useAppStore(state => state.setSelectedObjectId);

    // Derive selection state from global store
    const objectIdString = `object-${objectId}`;
    const isSelected = selectedObjectId === objectIdString;

    const updateOfficeObjectPosition = useCallback(async (input: {
        id: string;
        position: [number, number, number];
        rotation?: [number, number, number];
    }): Promise<void> => {
        const adapter = adapterRef.current;
        const current = await adapter.getOfficeObjects();
        const existing = current.find((item) => item.id === input.id);
        const payload = {
            id: input.id,
            identifier: existing?.identifier ?? input.id,
            meshType: (existing?.meshType ?? objectType) as "team-cluster" | "plant" | "couch" | "bookshelf" | "pantry" | "glass-wall",
            position: input.position,
            rotation: input.rotation ?? existing?.rotation ?? initialRotation,
            scale: existing?.scale,
            metadata: existing?.metadata ?? {},
        };
        const result = await adapter.upsertOfficeObject(payload);
        if (!result.ok) {
            throw new Error(result.error ?? "office_object_update_failed");
        }
    }, [objectType, initialRotation]);

    const deleteOfficeObject = useCallback(async (input: { id: string }): Promise<void> => {
        const result = await adapterRef.current.deleteOfficeObject(input.id);
        if (!result.ok) {
            throw new Error(result.error ?? "office_object_delete_failed");
        }
    }, []);

    // Initialize drag controller
    useEffect(() => {
        if (!groupRef.current || !isDragEnabled) return;

        const handleDragEnd = async (newPosition: THREE.Vector3) => {
            const newPosArray: [number, number, number] = [newPosition.x, newPosition.y, newPosition.z];

            // Optimistic update
            setLocalPosition(newPosArray);

            // Database sync
            try {
                await updateOfficeObjectPosition({
                    id: String(objectId),
                    position: newPosArray,
                });
            } catch (error) {
                console.error(`Failed to update ${objectId} position:`, error);
                setLocalPosition(initialPosition); // Revert on error
            }
        };

        const handleDragStateChange = (dragging: boolean) => {
            setIsLocallyDragging(dragging);
            setGlobalDragging(dragging);
        };

        controllerRef.current = new DraggableController(
            groupRef.current,
            camera,
            gl.domElement,
            handleDragEnd,
            handleDragStateChange
        );

        return () => {
            controllerRef.current?.destroy();
            controllerRef.current = null;
        };
    }, [isDragEnabled, camera, gl.domElement, objectId, updateOfficeObjectPosition, initialPosition, setGlobalDragging]);

    // Update position when prop changes (e.g., from database)
    useEffect(() => {
        if (!isLocallyDragging && groupRef.current) {
            groupRef.current.position.set(...localPosition);
        }
    }, [localPosition, isLocallyDragging]);

    // Handle selection - close other menus and toggle this one
    const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
        if (isLocallyDragging) return;
        e.stopPropagation();
        // If already selected, deselect. Otherwise, select this one (closing any other)
        if (isSelected) {
            setSelectedObjectId(null);
        } else {
            setSelectedObjectId(objectIdString);
        }
    }, [isLocallyDragging, isSelected, setSelectedObjectId, objectIdString]);

    // Handle rotation
    const handleRotate90 = useCallback(async (direction: 'left' | 'right') => {
        const rotationIncrement = direction === 'right' ? Math.PI / 2 : -Math.PI / 2;
        const newRotationY = localRotation[1] + rotationIncrement;
        const newRotArray: [number, number, number] = [localRotation[0], newRotationY, localRotation[2]];

        setLocalRotation(newRotArray);

        try {
            await updateOfficeObjectPosition({
                    id: String(objectId),
                position: localPosition,
                rotation: newRotArray,
            });
        } catch (error) {
            console.error(`Failed to update ${objectId} rotation:`, error);
            setLocalRotation(initialRotation);
        }
    }, [objectId, updateOfficeObjectPosition, localPosition, localRotation, initialRotation]);

    // Handle delete
    const handleDelete = useCallback(async () => {
        try {
            await deleteOfficeObject({ id: objectId });
        } catch (error) {
            console.error(`Failed to delete object ${objectId}:`, error);
        }
    }, [objectId, deleteOfficeObject]);

    // Handle move button
    const handleMoveMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (controllerRef.current && isDragEnabled) {
            controllerRef.current.startDrag(e.nativeEvent);
        }
    }, [isDragEnabled]);

    // Build actions for context menu
    const actions: MenuAction[] = customActions || [
        {
            id: 'move',
            label: 'Move',
            icon: Move,
            color: 'blue',
            position: 'top',
            onClick: () => { }, // Using onMouseDown instead
            onMouseDown: handleMoveMouseDown
        },
        {
            id: 'rotate-right',
            label: 'Rotate +90°',
            icon: RotateCw,
            color: 'green',
            position: 'right',
            onClick: () => handleRotate90('right')
        },
        {
            id: 'delete',
            label: 'Delete',
            icon: Trash2,
            color: 'red',
            position: 'bottom',
            onClick: handleDelete
        },
        onSettings ? {
            id: 'settings',
            label: 'Settings',
            icon: Settings,
            color: 'gray',
            position: 'left',
            onClick: onSettings
        } : {
            id: 'rotate-left',
            label: 'Rotate -90°',
            icon: RotateCcw,
            color: 'green',
            position: 'left',
            onClick: () => handleRotate90('left')
        }
    ];

    // Visual feedback
    const hoverScale = isHovered && !isSelected ? 1.02 : 1.0;

    useFrame(() => {
        if (groupRef.current) {
            const targetScale = new THREE.Vector3(hoverScale, hoverScale, hoverScale);
            groupRef.current.scale.lerp(targetScale, 0.1);
        }
    });

    // Format name for display
    const formattedName = objectType.split('-').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    return (
        <group
            ref={groupRef}
            position={localPosition}
            rotation={localRotation}
            onClick={handleClick}
            onPointerEnter={(e) => { e.stopPropagation(); setIsHovered(true); }}
            onPointerLeave={(e) => { e.stopPropagation(); setIsHovered(false); }}
        >
            {children}

            {/* Selection Highlight */}
            {showHoverEffect && (isHovered || isSelected) && (
                <Edges
                    scale={1.05}
                    color={isSelected ? "#00ff00" : "#ffffff"}
                    lineWidth={isSelected ? 2 : 1}
                />
            )}

            {/* Drag indicator */}
            {isLocallyDragging && (
                <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[1.5, 32]} />
                    <meshBasicMaterial
                        color="#ffff00"
                        transparent
                        opacity={0.2}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}

            {/* Context Menu */}
            <ContextMenu
                isOpen={isSelected}
                onClose={() => setSelectedObjectId(null)}
                actions={actions}
                title={formattedName}
            />
        </group>
    );
}


