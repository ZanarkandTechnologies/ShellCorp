import { useEffect, useRef, useState, useCallback } from 'react';
import { useFrame, ThreeEvent, useThree } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '@/lib/app-store';
import type { OfficeId } from '@/lib/types';
import { ContextMenu, MenuAction } from './context-menu';
import { Move, RotateCw, RotateCcw, Trash2, Settings, ZoomIn, ZoomOut } from 'lucide-react';
import { DraggableController } from '../controllers/draggable-controller';
import { resolvePersistedOfficeObjectId } from './office-object-id';
import { OFFICE_INTERACTION_COLORS } from '@/config/office-theme';
import { useOpenClawAdapter } from '@/providers/openclaw-adapter-provider';
import { parseOfficeObjectInteractionConfig } from '../office-object-ui';

interface InteractiveObjectProps {
    children: React.ReactNode;

    // Database
    objectId: OfficeId<"officeObjects">;
    objectType: string; // e.g., "plant", "couch", "team-cluster"
    companyId?: OfficeId<"companies">;

    // Transform
    initialPosition?: [number, number, number];
    initialRotation?: [number, number, number];
    initialScale?: [number, number, number];

    // Optional customization
    showHoverEffect?: boolean;
    customActions?: MenuAction[];
    onSettings?: () => void;
    metadata?: Record<string, unknown>;
    supportsScaling?: boolean;
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
    initialScale = [1, 1, 1],
    showHoverEffect = true,
    customActions,
    onSettings,
    metadata,
    supportsScaling = true,
}: InteractiveObjectProps) {
    const groupRef = useRef<THREE.Group>(null);
    const controllerRef = useRef<DraggableController | null>(null);
    const { camera, gl } = useThree();
    const adapter = useOpenClawAdapter();

    // Local state for optimistic updates
    const [localPosition, setLocalPosition] = useState<[number, number, number]>(initialPosition);
    const [localRotation, setLocalRotation] = useState<[number, number, number]>(initialRotation);
    const [localScale, setLocalScale] = useState<[number, number, number]>(initialScale);
    const [isHovered, setIsHovered] = useState(false);
    const [isLocallyDragging, setIsLocallyDragging] = useState(false);
    const lastConfirmedPositionRef = useRef<[number, number, number]>(initialPosition);
    const lastConfirmedRotationRef = useRef<[number, number, number]>(initialRotation);
    const lastConfirmedScaleRef = useRef<[number, number, number]>(initialScale);

    // Global state
    const isBuilderMode = useAppStore(state => state.isBuilderMode);
    const isDragEnabled = isBuilderMode && !!companyId;
    const setGlobalDragging = useAppStore(state => state.setIsDragging);
    const selectedObjectId = useAppStore(state => state.selectedObjectId);
    const setSelectedObjectId = useAppStore(state => state.setSelectedObjectId);
    const setActiveObjectConfigId = useAppStore(state => state.setActiveObjectConfigId);
    const setActiveObjectPanel = useAppStore(state => state.setActiveObjectPanel);

    // Derive selection state from global store
    const objectIdString = `object-${objectId}`;
    const isSelected = selectedObjectId === objectIdString;
    const interactionConfig = parseOfficeObjectInteractionConfig(metadata);

    const updateOfficeObjectPosition = useCallback(async (input: {
        id: string;
        position: [number, number, number];
        rotation?: [number, number, number];
        scale?: [number, number, number];
        metadata?: Record<string, unknown>;
    }): Promise<void> => {
        const current = await adapter.getOfficeObjects();
        const knownIds = new Set(current.map((item) => item.id));
        // MEM-0115: UI IDs can be prefixed while sidecar IDs may not be.
        const persistedId = resolvePersistedOfficeObjectId(input.id, knownIds);
        const existing = current.find((item) => item.id === persistedId);
        const payload = {
            id: persistedId,
            identifier: existing?.identifier ?? persistedId,
            meshType: (existing?.meshType ?? objectType) as "team-cluster" | "plant" | "couch" | "bookshelf" | "pantry" | "glass-wall" | "custom-mesh",
            position: input.position,
            rotation: input.rotation ?? existing?.rotation ?? initialRotation,
            scale: input.scale ?? existing?.scale ?? initialScale,
            metadata: input.metadata ?? existing?.metadata ?? metadata ?? {},
        };
        const result = await adapter.upsertOfficeObject(payload);
        if (!result.ok) {
            throw new Error(result.error ?? "office_object_update_failed");
        }
        lastConfirmedPositionRef.current = input.position;
        lastConfirmedRotationRef.current = payload.rotation;
        lastConfirmedScaleRef.current = payload.scale ?? initialScale;
    }, [adapter, objectType, initialRotation, initialScale, metadata]);

    const deleteOfficeObject = useCallback(async (input: { id: string }): Promise<void> => {
        const current = await adapter.getOfficeObjects();
        const knownIds = new Set(current.map((item) => item.id));
        const persistedId = resolvePersistedOfficeObjectId(input.id, knownIds);
        const result = await adapter.deleteOfficeObject(persistedId);
        if (!result.ok) {
            throw new Error(result.error ?? "office_object_delete_failed");
        }
    }, [adapter]);

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
                setLocalPosition(lastConfirmedPositionRef.current); // Revert on error
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

    // Keep local transform in sync only when canonical props change.
    // Drag end toggles isLocallyDragging; including it here causes snap-back to stale props.
    useEffect(() => {
        setLocalPosition(initialPosition);
        lastConfirmedPositionRef.current = initialPosition;
    }, [initialPosition, objectId]);

    useEffect(() => {
        setLocalRotation(initialRotation);
        lastConfirmedRotationRef.current = initialRotation;
    }, [initialRotation]);

    useEffect(() => {
        setLocalScale(initialScale);
        lastConfirmedScaleRef.current = initialScale;
    }, [initialScale]);

    useEffect(() => {
        if (!isBuilderMode && isSelected) {
            setSelectedObjectId(null);
        }
    }, [isBuilderMode, isSelected, setSelectedObjectId]);

    // Handle selection - close other menus and toggle this one
    const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
        if (isLocallyDragging) return;
        e.stopPropagation();
        if (!isBuilderMode) {
            setSelectedObjectId(null);
            if (interactionConfig.uiBinding.kind === "embed") {
                setActiveObjectPanel({
                    objectId,
                    title: interactionConfig.uiBinding.title,
                    url: interactionConfig.uiBinding.url,
                });
            }
            return;
        }
        // If already selected, deselect. Otherwise, select this one (closing any other)
        if (isSelected) {
            setSelectedObjectId(null);
        } else {
            setSelectedObjectId(objectIdString);
        }
    }, [
        interactionConfig.uiBinding,
        isBuilderMode,
        isLocallyDragging,
        isSelected,
        objectId,
        objectIdString,
        setActiveObjectPanel,
        setSelectedObjectId,
    ]);

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
            setLocalRotation(lastConfirmedRotationRef.current);
        }
    }, [objectId, updateOfficeObjectPosition, localPosition, localRotation, initialRotation]);

    // Handle delete
    const handleDelete = useCallback(async () => {
        try {
            await deleteOfficeObject({ id: objectId });
            setSelectedObjectId(null);
        } catch (error) {
            console.error(`Failed to delete object ${objectId}:`, error);
        }
    }, [objectId, deleteOfficeObject, setSelectedObjectId]);

    // Handle move button
    const handleMoveMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (controllerRef.current && isDragEnabled) {
            controllerRef.current.startDrag(e.nativeEvent);
        }
    }, [isDragEnabled]);

    const handleScale = useCallback(async (delta: number) => {
        const currentScalar = Number.isFinite(localScale[0]) ? localScale[0] : 1;
        const nextScalar = Math.min(3, Math.max(0.4, Number((currentScalar + delta).toFixed(2))));
        const nextScale: [number, number, number] = [nextScalar, nextScalar, nextScalar];
        setLocalScale(nextScale);
        try {
            await updateOfficeObjectPosition({
                id: String(objectId),
                position: localPosition,
                rotation: localRotation,
                scale: nextScale,
            });
        } catch (error) {
            console.error(`Failed to update ${objectId} scale:`, error);
            setLocalScale(lastConfirmedScaleRef.current);
        }
    }, [localPosition, localRotation, localScale, objectId, updateOfficeObjectPosition]);

    const handleSettings = useCallback(() => {
        if (onSettings) {
            onSettings();
            return;
        }
        setActiveObjectConfigId(objectId);
    }, [objectId, onSettings, setActiveObjectConfigId]);

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
        {
            id: 'settings',
            label: 'Settings',
            icon: Settings,
            color: 'gray',
            position: 'left',
            onClick: handleSettings
        },
        {
            id: 'rotate-left',
            label: 'Rotate -90°',
            icon: RotateCcw,
            color: 'green',
            onClick: () => handleRotate90('left')
        },
        ...(supportsScaling ? [
            {
                id: 'scale-up',
                label: 'Scale +',
                icon: ZoomIn,
                color: 'purple',
                onClick: () => handleScale(0.2)
            },
            {
                id: 'scale-down',
                label: 'Scale -',
                icon: ZoomOut,
                color: 'amber',
                onClick: () => handleScale(-0.2)
            }
        ] satisfies MenuAction[] : [])
    ];

    // Visual feedback
    const hoverScale = isHovered && !isSelected ? 1.02 : 1.0;

    useFrame(() => {
        if (groupRef.current) {
            const targetScale = new THREE.Vector3(
                localScale[0] * hoverScale,
                localScale[1] * hoverScale,
                localScale[2] * hoverScale,
            );
            groupRef.current.scale.lerp(targetScale, 0.1);
        }
    });

    // Format name for display
    const formattedName = objectType.split('-').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
    const objectTitle = interactionConfig.displayName ?? formattedName;

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
                    color={isSelected ? OFFICE_INTERACTION_COLORS.selectionEdge : OFFICE_INTERACTION_COLORS.hoverEdge}
                    lineWidth={isSelected ? 2 : 1}
                />
            )}

            {/* Drag indicator */}
            {isLocallyDragging && (
                <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[1.5, 32]} />
                    <meshBasicMaterial
                        color={OFFICE_INTERACTION_COLORS.dragIndicator}
                        transparent
                        opacity={0.2}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}

            {/* Context Menu */}
            <ContextMenu
                isOpen={isBuilderMode && isSelected}
                onClose={() => setSelectedObjectId(null)}
                actions={actions}
                title={objectTitle}
            />
        </group>
    );
}


