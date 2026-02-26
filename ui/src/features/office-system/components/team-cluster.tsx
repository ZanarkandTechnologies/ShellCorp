/**
 * TEAM CLUSTER
 * ============
 * 
 * Renders a team's physical workspace with dynamic desk layout.
 * 
 * INTERACTION MODES:
 * 1. Placement mode → Click to assign desk to this team
 * 2. Builder mode → Click to open team settings (via context menu)
 * 3. Default mode → Click to open team chat
 * 
 * VISUAL BEHAVIOR:
 * - Shows flag/banner when team has 0 desks
 * - Shows floor circle in builder/placement modes only
 * - Desks auto-arrange using layout utility functions
 */
import { useState, useMemo } from 'react';
import type { Id } from '@/convex/_generated/dataModel';
import type { TeamData, DeskLayoutData } from '@/lib/types';
import type { ThreeEvent } from '@react-three/fiber';
import Desk from './desk';
import { InteractiveObject } from './interactive-object';
import { useAppStore } from '@/lib/app-store';
import { Text, Html } from '@react-three/drei';
import { getClusterAnchor, getDeskPosition, getDeskRotation } from '@/convex/utils/layout';

// Constants
const MAX_DESKS_PER_TEAM = 6;

// ============================================================================
// GHOST COMPONENT (For Placement Mode)
// ============================================================================
export function TeamClusterGhost() {
    return (
        <group name="team-marker-ghost">
            {/* Floor Mat */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <circleGeometry args={[2, 32]} />
                <meshStandardMaterial color="blue" opacity={0.3} transparent />
            </mesh>
            {/* Center Pole */}
            <mesh position={[0, 1, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
                <meshStandardMaterial color="blue" opacity={0.5} transparent />
            </mesh>
            {/* Banner Flag */}
            <mesh position={[0, 1.5, 0.4]} rotation={[0, 0, 0]}>
                <boxGeometry args={[0.05, 0.8, 0.8]} />
                <meshStandardMaterial color="blue" opacity={0.5} transparent />
            </mesh>
        </group>
    );
}

interface TeamClusterProps {
    team: TeamData;
    desks: DeskLayoutData[]; // Desk records from database with real IDs
    handleTeamClick: (team: TeamData) => void;
    objectId: Id<"officeObjects">;
    position?: [number, number, number];
    rotation?: [number, number, number];
    companyId?: Id<"companies">;
}

export default function TeamCluster({
    team,
    desks,
    handleTeamClick,
    objectId,
    position,
    rotation,
    companyId,
}: TeamClusterProps) {
    const [isHovered, setIsHovered] = useState(false);

    // App state
    const isBuilderMode = useAppStore(state => state.isBuilderMode);
    const placementMode = useAppStore(state => state.placementMode);
    const setPlacementMode = useAppStore(state => state.setPlacementMode);
    const setIsTeamOptionsDialogOpen = useAppStore(state => state.setIsTeamOptionsDialogOpen);
    const setActiveTeamForOptions = useAppStore(state => state.setActiveTeamForOptions);
    const isDragging = useAppStore(state => state.isDragging);

    // Capacity tracking
    const currentDeskCount = desks.length;
    const isAtCapacity = currentDeskCount >= MAX_DESKS_PER_TEAM;
    const remainingSlots = MAX_DESKS_PER_TEAM - currentDeskCount;

    // Handle cluster click
    const handleClusterClick = (event: ThreeEvent<MouseEvent>) => {
        if (isDragging) return;

        // Priority 1: Placement Mode - Check if placing a desk
        if (placementMode.active && placementMode.type === "desk") {
            event.stopPropagation();

            // Check capacity before allowing placement
            if (isAtCapacity) {
                console.warn(`Team "${team.name}" is at maximum capacity (${MAX_DESKS_PER_TEAM} desks)`);
                // Still set placement mode but with capacity error flag
                setPlacementMode({
                    active: true,
                    type: placementMode.type,
                    data: {
                        ...placementMode.data,
                        pendingTeamId: team._id,
                        teamName: team.name,
                        capacityError: true,
                        maxCapacity: MAX_DESKS_PER_TEAM
                    }
                });
                return;
            }

            // Store the pending team ID in placement data so the confirmation panel can use it
            setPlacementMode({
                active: true,
                type: placementMode.type,
                data: {
                    ...placementMode.data,
                    pendingTeamId: team._id,
                    teamName: team.name,
                    remainingSlots
                }
            });
            return;
        }

        // Priority 2: Builder Mode → Let InteractiveObject handle selection
        if (isBuilderMode) return;

        // Priority 3: Default Mode → Open team chat
        event.stopPropagation();
        handleTeamClick(team);
    };

    // Settings handler (called from context menu)
    const handleOpenSettings = () => {
        setActiveTeamForOptions(team);
        setIsTeamOptionsDialogOpen(true);
    };

    // Enable hover effects when not in builder mode or when in placement mode
    const shouldEnableLocalHover = !isBuilderMode || placementMode.active;

    // Desk layout (auto-calculates positions based on team center)
    const desksWithPositions = useMemo(() => {
        // TeamCluster is already transformed by wrapper position; keep desks local.
        const clusterPos: [number, number, number] = [0, 0, 0];
        const orderedDesks = desks
            .map((desk, originalIndex) => ({
                desk,
                originalIndex,
                // Missing/duplicate indices can happen after sidecar edits.
                // Sort by persisted index, then normalize to compact 0..N-1.
                persistedIndex: Number.isFinite(desk.deskIndex) ? (desk.deskIndex as number) : Number.MAX_SAFE_INTEGER,
            }))
            .sort((a, b) =>
                a.persistedIndex === b.persistedIndex
                    ? a.originalIndex - b.originalIndex
                    : a.persistedIndex - b.persistedIndex,
            );
        return orderedDesks.map(({ desk }, layoutIndex) => ({
            id: desk.id,
            position: getDeskPosition(clusterPos, layoutIndex, orderedDesks.length),
            rotationY: getDeskRotation(layoutIndex, orderedDesks.length),
        }));
    }, [desks]);

    const signboardPosition = useMemo<[number, number, number]>(() => {
        const [anchorX, , anchorZ] = getClusterAnchor(desksWithPositions.length);
        return [anchorX, 0.8, anchorZ];
    }, [desksWithPositions.length]);

    // Render conditions
    const showFlag = desks.length === 0;
    const showCircle = isBuilderMode || placementMode.active;

    return (
        <InteractiveObject
            objectType="team-cluster"
            objectId={objectId}
            companyId={companyId}
            initialPosition={position}
            initialRotation={rotation}
            onSettings={handleOpenSettings}
        >
            <group
                onPointerEnter={shouldEnableLocalHover ? () => setIsHovered(true) : undefined}
                onPointerLeave={shouldEnableLocalHover ? () => setIsHovered(false) : undefined}
                onClick={handleClusterClick}
            >
                {/* Team Marker/Base */}
                <group name="team-marker">
                    {/* Floor Mat - Only visible in Builder/Placement mode */}
                    {showCircle && (
                        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
                            <circleGeometry args={[2, 32]} />
                            <meshStandardMaterial
                                color={isHovered ? "#a7f3d0" : "#e5e7eb"}
                                opacity={0.5}
                                transparent
                            />
                        </mesh>
                    )}

                    {/* Flag/Sign - Only visible if NO desks */}
                    {showFlag && (
                        <>
                            {/* Center Pole/Banner */}
                            <mesh position={[0, 1, 0]} castShadow>
                                <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
                                <meshStandardMaterial color="#6b7280" />
                            </mesh>

                            {/* Banner Flag */}
                            <mesh position={[0, 1.5, 0.4]} rotation={[0, 0, 0]} castShadow>
                                <boxGeometry args={[0.05, 0.8, 0.8]} />
                                <meshStandardMaterial color={team.name === "Management" ? "#ef4444" : "#3b82f6"} />
                            </mesh>

                            {/* Team Name Sign */}
                            <group position={[0, 2.0, 0]}>
                                <Text
                                    position={[0, 0, 0]}
                                    fontSize={0.3}
                                    color="black"
                                    anchorX="center"
                                    anchorY="middle"
                                    outlineWidth={0.02}
                                    outlineColor="white"
                                >
                                    {team.name}
                                </Text>
                            </group>
                        </>
                    )}
                </group>

                {/* Mini Signboard Banner - Always visible (except for CEO/Management team) */}
                {team.name !== "CEO" && (
                    <group name="team-signboard" position={signboardPosition}>
                        {/* Signboard Post */}
                        <mesh position={[0, 0, 0]} castShadow>
                            <cylinderGeometry args={[0.03, 0.03, 0.8, 8]} />
                            <meshStandardMaterial color="#4b5563" />
                        </mesh>

                        {/* Signboard Panel */}
                        <group position={[0, 0.4, 0]}>
                            {/* Back panel for depth */}
                            <mesh position={[0, 0, -0.01]} castShadow>
                                <boxGeometry args={[1.2, 0.4, 0.02]} />
                                <meshStandardMaterial color="#1f2937" />
                            </mesh>

                            {/* Front panel */}
                            <mesh position={[0, 0, 0]} castShadow>
                                <boxGeometry args={[1.2, 0.4, 0.02]} />
                                <meshStandardMaterial
                                    color="#2563eb"
                                    metalness={0.3}
                                    roughness={0.7}
                                />
                            </mesh>

                            {/* Team Name Text */}
                            <Text
                                position={[0, 0, 0.015]}
                                fontSize={0.18}
                                color="white"
                                anchorX="center"
                                anchorY="middle"
                                outlineWidth={0.01}
                                outlineColor="#000000"
                            >
                                {team.name}
                            </Text>
                        </group>

                        {/* Small decorative top cap */}
                        <mesh position={[0, 0.8, 0]} castShadow>
                            <sphereGeometry args={[0.04, 8, 8]} />
                            <meshStandardMaterial color="#6b7280" />
                        </mesh>
                    </group>
                )}

                {/* Team Label - Always visible in builder mode, otherwise on hover */}
                {(isBuilderMode || (isHovered && shouldEnableLocalHover)) && (
                    <Html
                        position={[0, 2.8, 0]}
                        center
                        zIndexRange={[100, 0]}
                        style={{
                            pointerEvents: 'none',
                            userSelect: 'none',
                        }}
                    >
                        <div className="animate-in fade-in zoom-in-95 duration-200">
                            <div className={`px-3 py-1.5 rounded-md text-xs font-medium shadow-lg whitespace-nowrap ${isAtCapacity && placementMode.active && placementMode.type === "desk"
                                ? 'bg-destructive text-destructive-foreground'
                                : 'bg-foreground text-background'
                                }`}>
                                <div>{team.name}</div>
                                {placementMode.active && placementMode.type === "desk" && (
                                    <div className="text-[10px] opacity-80 mt-0.5">
                                        {isAtCapacity ? `⚠️ At Capacity (${MAX_DESKS_PER_TEAM}/${MAX_DESKS_PER_TEAM})` : `${currentDeskCount}/${MAX_DESKS_PER_TEAM} desks`}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Html>
                )}

                {/* Desks with auto-calculated positions */}
                {desksWithPositions.map((desk) => (
                    <Desk
                        key={desk.id}
                        deskId={desk.id}
                        position={desk.position}
                        rotationY={desk.rotationY}
                        isHovered={shouldEnableLocalHover && isHovered}
                    />
                ))}
            </group>
        </InteractiveObject>
    );
}
