import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
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
import { beginObjectInteractionTrace } from '../utils/object-interaction-perf';
import {
    DEFAULT_INTERACTIVE_OBJECT_POSITION,
    DEFAULT_INTERACTIVE_OBJECT_ROTATION,
    DEFAULT_INTERACTIVE_OBJECT_SCALE,
    syncTuple3,
} from './interactive-object-vectors';

interface InteractiveObjectProps {
    children: React.ReactNode;
    objectId: OfficeId<"officeObjects">;
    objectType: string;
    companyId?: OfficeId<"companies">;
    initialPosition?: [number, number, number];
    initialRotation?: [number, number, number];
    initialScale?: [number, number, number];
    showHoverEffect?: boolean;
    customActions?: MenuAction[];
    onSettings?: () => void;
    metadata?: Record<string, unknown>;
    supportsScaling?: boolean;
    interactionBounds?: {
        center: [number, number, number];
        size: [number, number, number];
        highlightRadius: number;
    };
}

/**
 * INTERACTIVE OBJECT - Unified Component
 * ======================================
 * All-in-one component for selectable, draggable 3D objects in the office scene.
 */
export function InteractiveObject({
    children,
    objectId,
    objectType,
    companyId,
    initialPosition = DEFAULT_INTERACTIVE_OBJECT_POSITION,
    initialRotation = DEFAULT_INTERACTIVE_OBJECT_ROTATION,
    initialScale = DEFAULT_INTERACTIVE_OBJECT_SCALE,
    showHoverEffect = true,
    customActions,
    onSettings,
    metadata,
    supportsScaling = true,
    interactionBounds,
}: InteractiveObjectProps) {
    const groupRef = useRef<THREE.Group>(null);
    const contentRef = useRef<THREE.Group>(null);
    const controllerRef = useRef<DraggableController | null>(null);
    const { camera, gl } = useThree();
    const adapter = useOpenClawAdapter();
    const objectIdString = `object-${objectId}`;
    const [localPosition, setLocalPosition] = useState<[number, number, number]>(initialPosition);
    const [localRotation, setLocalRotation] = useState<[number, number, number]>(initialRotation);
    const [localScale, setLocalScale] = useState<[number, number, number]>(initialScale);
    const [isHovered, setIsHovered] = useState(false);
    const [isLocallyDragging, setIsLocallyDragging] = useState(false);
    const [highlightRadius, setHighlightRadius] = useState(1.1);
    const lastConfirmedPositionRef = useRef<[number, number, number]>(initialPosition);
    const lastConfirmedRotationRef = useRef<[number, number, number]>(initialRotation);
    const lastConfirmedScaleRef = useRef<[number, number, number]>(initialScale);
    const isBuilderMode = useAppStore(state => state.isBuilderMode);
    const isDragEnabled = isBuilderMode && !!companyId;
    const setGlobalDragging = useAppStore(state => state.setIsDragging);
    const isSelected = useAppStore(state => state.selectedObjectId === objectIdString);
    const setSelectedObjectId = useAppStore(state => state.setSelectedObjectId);
    const setActiveObjectConfigId = useAppStore(state => state.setActiveObjectConfigId);
    const setActiveObjectPanel = useAppStore(state => state.setActiveObjectPanel);
    const activeObjectConfigId = useAppStore(state => state.activeObjectConfigId);

    const interactionConfig = useMemo(() => parseOfficeObjectInteractionConfig(metadata), [metadata]);

    const persistOfficeObject = useCallback(async (input: {
        id: string;
        position: [number, number, number];
        rotation?: [number, number, number];
        scale?: [number, number, number];
        metadata?: Record<string, unknown>;
    }): Promise<void> => {
        const current = await adapter.getOfficeObjects();
        const knownIds = new Set(current.map((item) => item.id));
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
        const result = await adapter.upsertOfficeObject(payload, { currentObjects: current });
        if (!result.ok) {
            throw new Error(result.error ?? "office_object_update_failed");
        }
        lastConfirmedPositionRef.current = input.position;
        lastConfirmedRotationRef.current = payload.rotation;
        lastConfirmedScaleRef.current = payload.scale ?? initialScale;
    }, [adapter, initialRotation, initialScale, metadata, objectType]);

    const deleteOfficeObject = useCallback(async (input: { id: string }): Promise<void> => {
        const current = await adapter.getOfficeObjects();
        const knownIds = new Set(current.map((item) => item.id));
        const persistedId = resolvePersistedOfficeObjectId(input.id, knownIds);
        const result = await adapter.deleteOfficeObject(persistedId, { currentObjects: current });
        if (!result.ok) {
            throw new Error(result.error ?? "office_object_delete_failed");
        }
    }, [adapter]);

    useEffect(() => {
        if (!groupRef.current || !isDragEnabled) return;

        const handleDragEnd = async (newPosition: THREE.Vector3) => {
            const newPosArray: [number, number, number] = [newPosition.x, newPosition.y, newPosition.z];
            setLocalPosition(newPosArray);

            try {
                await persistOfficeObject({
                    id: String(objectId),
                    position: newPosArray,
                });
            } catch (error) {
                console.error(`Failed to update ${objectId} position:`, error);
                setLocalPosition(lastConfirmedPositionRef.current);
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
    }, [camera, gl.domElement, isDragEnabled, objectId, persistOfficeObject, setGlobalDragging]);

    useEffect(() => {
        if (!isLocallyDragging && groupRef.current) {
            groupRef.current.position.set(...localPosition);
        }
    }, [localPosition, isLocallyDragging]);

    useEffect(() => {
        setLocalPosition(currentPosition => syncTuple3(currentPosition, initialPosition));
        lastConfirmedPositionRef.current = initialPosition;
    }, [initialPosition, objectId]);

    useEffect(() => {
        setLocalRotation(currentRotation => syncTuple3(currentRotation, initialRotation));
        lastConfirmedRotationRef.current = initialRotation;
    }, [initialRotation]);

    useEffect(() => {
        setLocalScale(currentScale => syncTuple3(currentScale, initialScale));
        lastConfirmedScaleRef.current = initialScale;
    }, [initialScale]);

    useEffect(() => {
        if (!isBuilderMode && isSelected) {
            setSelectedObjectId(null);
        }
    }, [isBuilderMode, isSelected, setSelectedObjectId]);

    useEffect(() => {
        if (activeObjectConfigId !== objectId) return;
        setIsHovered(false);
    }, [activeObjectConfigId, objectId]);

    useEffect(() => {
        if (interactionBounds) {
            setHighlightRadius(interactionBounds.highlightRadius);
            return;
        }
        if (!contentRef.current) return;
        const bounds = new THREE.Box3().setFromObject(contentRef.current);
        if (bounds.isEmpty()) return;
        const size = bounds.getSize(new THREE.Vector3());
        setHighlightRadius(Math.max(0.85, Math.max(size.x, size.z) * 0.55));
    }, [children, interactionBounds, objectType]);

    const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
        if (isLocallyDragging) return;
        e.stopPropagation();
        if (!isBuilderMode) {
            if (interactionConfig.uiBinding.kind === "embed") {
                const openedAtMs = typeof performance !== "undefined" ? performance.now() : Date.now();
                beginObjectInteractionTrace("runtime-panel", String(objectId), {
                    title: interactionConfig.uiBinding.title,
                });
                if (import.meta.env.DEV) {
                    console.debug("[perf] office-object-modal-click", {
                        objectId: String(objectId),
                        title: interactionConfig.uiBinding.title,
                        openedAtMs,
                    });
                }
                setActiveObjectPanel({
                    objectId,
                    title: interactionConfig.uiBinding.title,
                    url: interactionConfig.uiBinding.url,
                    displayName: interactionConfig.displayName,
                    aspectRatio: interactionConfig.uiBinding.aspectRatio,
                    openedAtMs,
                });
            }
            return;
        }

        if (isSelected) {
            beginObjectInteractionTrace("builder-panel", String(objectId), { source: "repeat-click" });
            setSelectedObjectId(null);
            setActiveObjectConfigId(objectId);
            return;
        }

        beginObjectInteractionTrace("builder-menu", String(objectId), { source: "click" });
        setSelectedObjectId(objectIdString);
    }, [
        interactionConfig.displayName,
        interactionConfig.uiBinding,
        setActiveObjectConfigId,
        isBuilderMode,
        isLocallyDragging,
        isSelected,
        objectId,
        objectIdString,
        setActiveObjectPanel,
        setSelectedObjectId,
    ]);

    const handleRotate90 = useCallback(async (direction: 'left' | 'right') => {
        const rotationIncrement = direction === 'right' ? Math.PI / 2 : -Math.PI / 2;
        const newRotationY = localRotation[1] + rotationIncrement;
        const newRotArray: [number, number, number] = [localRotation[0], newRotationY, localRotation[2]];

        setLocalRotation(newRotArray);

        try {
            await persistOfficeObject({
                id: String(objectId),
                position: localPosition,
                rotation: newRotArray,
            });
        } catch (error) {
            console.error(`Failed to update ${objectId} rotation:`, error);
            setLocalRotation(lastConfirmedRotationRef.current);
        }
    }, [localPosition, localRotation, objectId, persistOfficeObject]);

    const handleDelete = useCallback(async () => {
        try {
            await deleteOfficeObject({ id: objectId });
            setSelectedObjectId(null);
        } catch (error) {
            console.error(`Failed to delete object ${objectId}:`, error);
        }
    }, [objectId, deleteOfficeObject, setSelectedObjectId]);

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
            await persistOfficeObject({
                id: String(objectId),
                position: localPosition,
                rotation: localRotation,
                scale: nextScale,
            });
        } catch (error) {
            console.error(`Failed to update ${objectId} scale:`, error);
            setLocalScale(lastConfirmedScaleRef.current);
        }
    }, [localPosition, localRotation, localScale, objectId, persistOfficeObject]);

    const handleSettings = useCallback(() => {
        if (onSettings) {
            onSettings();
            return;
        }
        beginObjectInteractionTrace("builder-panel", String(objectId), { source: "settings" });
        setSelectedObjectId(null);
        setActiveObjectConfigId(objectId);
    }, [objectId, onSettings, setActiveObjectConfigId, setSelectedObjectId]);

    const actions: MenuAction[] = useMemo(() => customActions || [
        { id: 'move', label: 'Move', icon: Move, color: 'blue', position: 'top', onClick: () => {}, onMouseDown: handleMoveMouseDown },
        { id: 'rotate-right', label: 'Rotate +90°', icon: RotateCw, color: 'green', position: 'right', onClick: () => handleRotate90('right') },
        { id: 'delete', label: 'Delete', icon: Trash2, color: 'red', position: 'bottom', onClick: handleDelete },
        { id: 'settings', label: 'Settings', icon: Settings, color: 'gray', position: 'left', onClick: handleSettings },
        { id: 'rotate-left', label: 'Rotate -90°', icon: RotateCcw, color: 'green', onClick: () => handleRotate90('left') },
        ...(supportsScaling ? [
            { id: 'scale-up', label: 'Scale +', icon: ZoomIn, color: 'purple', onClick: () => handleScale(0.2) },
            { id: 'scale-down', label: 'Scale -', icon: ZoomOut, color: 'amber', onClick: () => handleScale(-0.2) },
        ] satisfies MenuAction[] : []),
    ], [customActions, handleDelete, handleMoveMouseDown, handleRotate90, handleScale, handleSettings, supportsScaling]);

    const formattedName = useMemo(() => objectType.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '), [objectType]);
    const objectTitle = interactionConfig.displayName ?? formattedName;
    const highlightColor = isSelected ? OFFICE_INTERACTION_COLORS.selectionEdge : OFFICE_INTERACTION_COLORS.hoverEdge;
    const showInteractionHighlight = showHoverEffect && (isHovered || isSelected);

    return (
        <group
            ref={groupRef}
            position={localPosition}
            rotation={localRotation}
            scale={localScale}
            onClick={handleClick}
            onPointerEnter={(e) => {
                e.stopPropagation();
                if (import.meta.env.DEV && interactionConfig.uiBinding.kind === "embed") {
                    console.debug("[office-object] pointer-enter", {
                        objectId: String(objectId),
                        objectType,
                        title: interactionConfig.uiBinding.title,
                        highlightRadius,
                        scale: localScale,
                        interactionBounds,
                    });
                }
                setIsHovered(true);
            }}
            onPointerLeave={(e) => {
                e.stopPropagation();
                setIsHovered(false);
            }}
        >
            {interactionBounds ? (
                <mesh position={interactionBounds.center}>
                    <boxGeometry args={interactionBounds.size} />
                    <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>
            ) : null}

            <group ref={contentRef}>
                {children}
            </group>

            {showInteractionHighlight && (
                <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
                    <ringGeometry args={[highlightRadius * 0.78, highlightRadius, 32]} />
                    <meshBasicMaterial
                        color={highlightColor}
                        transparent
                        opacity={isSelected ? 0.45 : 0.28}
                        depthWrite={false}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}

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

            <ContextMenu
                isOpen={isBuilderMode && isSelected && activeObjectConfigId !== objectId}
                onClose={() => setSelectedObjectId(null)}
                actions={actions}
                title={objectTitle}
                perfObjectId={String(objectId)}
            />
        </group>
    );
}
