import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Box, Edges, Html } from "@react-three/drei";
import {
    HAIR_COLORS, HAIR_WIDTH, HAIR_HEIGHT,
    HEAD_HEIGHT, HEAD_WIDTH,
    PANTS_COLORS, SHIRT_COLORS, SKIN_COLORS,
    TOTAL_HEIGHT,
    BODY_HEIGHT, LEG_HEIGHT, BODY_WIDTH,
    IDLE_DESTINATIONS
} from "@/constants";
import type { Group } from "three";
import * as THREE from 'three';
import { findPathAStar } from "@/features/nav-system/pathfinding/a-star-pathfinding";
import { findAvailableDestination, releaseEmployeeReservations } from "@/features/nav-system/pathfinding/destination-registry";
import PathVisualizer from "@/features/nav-system/components/path-visualizer";
import StatusIndicator, { StatusType } from "@/features/nav-system/components/status-indicator";
import { getRandomItem } from "@/lib/utils";
import { ContextMenu } from "./context-menu";
import { MessageSquare, Monitor, UserCog, CheckSquare, Book } from 'lucide-react';
import { useAppStore } from "@/lib/app-store";
import { Id } from "@/convex/_generated/dataModel";

interface EmployeeProps {
    _id: Id<"employees">;
    name: string;
    position: [number, number, number];
    isBusy?: boolean;
    isCEO?: boolean;
    isSupervisor?: boolean;
    gender?: string;
    onClick: () => void;
    debugMode?: boolean;
    status?: StatusType;
    statusMessage?: string;
    wantsToWander?: boolean;
    jobTitle?: string;
    team?: string;
    notificationCount?: number;
    notificationPriority?: number;
    profileImageUrl?: string; // Profile image URL for expert imports (displayed as head texture)
}

/**
 * ProfileHead - Head mesh with profile image overlay
 * Uses HTML img overlay with transform mode to embed in 3D space
 * This ensures the image stays visible and properly sized relative to the head
 * 
 * Features:
 * - Skin-colored head mesh as base
 * - Profile image on front face
 * - Hair-colored back panel to distinguish front from back
 * - Image is occluded by geometry when viewed from behind/sides
 */
const ProfileHead = memo(function ProfileHead({
    imageUrl,
    position,
    skinColor,
    hairColor
}: {
    imageUrl: string;
    position: [number, number, number];
    skinColor: string;
    hairColor: string;
}) {
    const [imageError, setImageError] = useState(false);

    // Validate imageUrl is not empty
    const isValidUrl = imageUrl && imageUrl.trim().length > 0;

    // Back of head hair panel - slightly thinner to sit on the back
    const backHairDepth = HEAD_WIDTH * 0.3;

    return (
        <group position={position}>
            {/* Base head mesh - skin colored */}
            <Box args={[HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH]} castShadow>
                <meshStandardMaterial color={skinColor} />
            </Box>

            {/* Back of head hair panel - extends from the back to show direction */}
            <Box
                args={[HEAD_WIDTH, HEAD_HEIGHT, backHairDepth]}
                position={[0, 0, -HEAD_WIDTH / 2 - backHairDepth / 2 + 0.01]}
                castShadow
            >
                <meshStandardMaterial color={hairColor} />
            </Box>

            {/* Profile image overlay on front face - uses blending occlusion */}
            {/* zIndexRange set low (0-10) to stay behind modals (z-index 1000+) */}
            {isValidUrl && !imageError && (
                <Html
                    position={[0, 0, HEAD_WIDTH / 2 + 0.005]}
                    center
                    transform
                    scale={0.3}
                    occlude="blending"
                    zIndexRange={[10, 0]}
                    style={{
                        pointerEvents: 'none',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                    }}
                >
                    <img
                        src={imageUrl}
                        alt="Profile"
                        onLoad={() => {
                            console.log('[ProfileHead] Image loaded successfully:', imageUrl);
                        }}
                        onError={(e) => {
                            console.error('[ProfileHead] Image failed to load:', imageUrl, e);
                            setImageError(true);
                        }}
                        style={{
                            width: '40px',
                            height: '25px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            display: 'block',
                            backfaceVisibility: 'hidden',
                        }}
                    />
                </Html>
            )}
        </group>
    );
});

const PropellerHat = () => {
    const propellerRef = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        if (propellerRef.current) {
            propellerRef.current.rotation.y += delta * 5; // Spin speed
        }
    });

    // Hat dimensions relative to head
    const hatWidth = HEAD_WIDTH * 1.0; // Snug fit
    const hatHeight = 0.05;

    return (
        <group position={[0, HAIR_HEIGHT / 2 + hatHeight / 2, 0]}>
            {/* Cap (Blue/Red/Yellow/Green quadrants simulated by small boxes) */}
            <group>
                <Box args={[hatWidth / 2, hatHeight, hatWidth / 2]} position={[-hatWidth / 4, 0, -hatWidth / 4]}>
                    <meshStandardMaterial color="#4285F4" /> {/* Blue */}
                </Box>
                <Box args={[hatWidth / 2, hatHeight, hatWidth / 2]} position={[hatWidth / 4, 0, -hatWidth / 4]}>
                    <meshStandardMaterial color="#EA4335" /> {/* Red */}
                </Box>
                <Box args={[hatWidth / 2, hatHeight, hatWidth / 2]} position={[-hatWidth / 4, 0, hatWidth / 4]}>
                    <meshStandardMaterial color="#FBBC05" /> {/* Yellow */}
                </Box>
                <Box args={[hatWidth / 2, hatHeight, hatWidth / 2]} position={[hatWidth / 4, 0, hatWidth / 4]}>
                    <meshStandardMaterial color="#34A853" /> {/* Green */}
                </Box>
            </group>

            {/* Stem */}
            <Box args={[0.01, 0.08, 0.01]} position={[0, hatHeight, 0]}>
                <meshStandardMaterial color="#FFFFFF" />
            </Box>

            {/* Propeller */}
            <group ref={propellerRef} position={[0, hatHeight + 0.08, 0]}>
                <Box args={[0.2, 0.005, 0.02]}>
                    <meshStandardMaterial color="#EA4335" /> {/* Red Blade */}
                </Box>
                <Box args={[0.02, 0.005, 0.2]}>
                    <meshStandardMaterial color="#4285F4" /> {/* Blue Blade */}
                </Box>
            </group>
        </group>
    );
};

const Employee = memo(function Employee({
    _id: id,
    name,
    position,
    isBusy,
    isCEO,
    isSupervisor,
    gender,
    onClick,
    profileImageUrl,
    debugMode = false,
    status = 'none' as StatusType,
    statusMessage,
    wantsToWander = true,
    jobTitle,
    team,
    notificationCount = 0,
    notificationPriority = 0,
}: EmployeeProps) {
    const groupRef = useRef<Group>(null);
    const initialPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(position[0], TOTAL_HEIGHT / 2, position[2]));

    // Debug: Log profileImageUrl if present
    useEffect(() => {
        if (profileImageUrl) {
            console.log(`[Employee ${id}] profileImageUrl:`, profileImageUrl);
        }
    }, [id, profileImageUrl]);

    // Selection state - use global store to ensure only one menu is open
    const selectedObjectId = useAppStore(state => state.selectedObjectId);
    const setSelectedObjectId = useAppStore(state => state.setSelectedObjectId);
    const setManageAgentEmployeeId = useAppStore(state => state.setManageAgentEmployeeId);
    const setViewComputerEmployeeId = useAppStore(state => state.setViewComputerEmployeeId);
    const viewComputerEmployeeId = useAppStore(state => state.viewComputerEmployeeId);
    const setTrainingEmployeeId = useAppStore(state => state.setTrainingEmployeeId);
    const setTaskStatusEmployeeId = useAppStore(state => state.setTaskStatusEmployeeId);

    const [isHovered, setIsHovered] = useState(false);
    const highlightedEmployeeIds = useAppStore(state => state.highlightedEmployeeIds);
    const isHighlighted = highlightedEmployeeIds.has(id);

    // Check if we are the one being viewed
    const isViewComputerOpen = viewComputerEmployeeId === id;
    const setIsViewComputerOpen = (open: boolean) => {
        setViewComputerEmployeeId(open ? id : null);
    };

    // Derive selection state from global store
    const employeeIdString = `employee-${id}`;
    const isSelected = selectedObjectId === employeeIdString;

    // Access chat functionality from App Store, not just Chat Store
    const setIsChatModalOpen = useAppStore(state => state.setIsChatModalOpen);
    const setActiveChatParticipant = useAppStore(state => state.setActiveChatParticipant);
    const setIsUserTasksModalOpen = useAppStore(state => state.setIsUserTasksModalOpen);

    // Path State
    const [path, setPath] = useState<THREE.Vector3[] | null>(null);
    const [pathIndex, setPathIndex] = useState<number>(0);
    const [currentDestination, setCurrentDestination] = useState<THREE.Vector3 | null>(null);

    // Added: Store the original path for visualization (doesn't change as employee moves)
    const [originalPath, setOriginalPath] = useState<THREE.Vector3[] | null>(null);

    // Idle State
    const [idleState, setIdleState] = useState<'wandering' | 'waiting'>('wandering');
    // Use ref for idleTimer to avoid re-renders every frame
    const idleTimerRef = useRef<number>(0);

    // Added flag for going to desk
    const [isGoingToDesk, setIsGoingToDesk] = useState(false);

    // Debug path visualization - refs and state declared before useFrame
    const debugPathUpdateRef = useRef<number>(0);
    const [debugPathData, setDebugPathData] = useState<{
        originalPath: THREE.Vector3[] | null;
        remainingPath: THREE.Vector3[] | null;
    }>({ originalPath: null, remainingPath: null });

    // Debug: Track shouldBeAtDesk state changes
    const shouldBeAtDeskRef = useRef<boolean>(false);

    const movementSpeed = 1.5; // Units per second
    const arrivalThreshold = 0.1;

    // Colors (no change)
    const colors = useMemo(() => ({
        hair: getRandomItem(HAIR_COLORS),
        skin: getRandomItem(SKIN_COLORS),
        shirt: getRandomItem(SHIRT_COLORS),
        pants: getRandomItem(PANTS_COLORS),
    }), []);
    const finalColors = useMemo(() => isCEO ? {
        hair: "#FFD700", skin: getRandomItem(SKIN_COLORS), shirt: "#4B0082", pants: "#000000",
    } : colors, [isCEO, colors]);

    // Release destination reservations when component unmounts
    useEffect(() => {
        return () => {
            releaseEmployeeReservations(id);
        };
    }, [id]);

    // Set initial position
    useEffect(() => {
        if (groupRef.current) {
            groupRef.current.position.copy(initialPositionRef.current);
        }
    }, []);

    // Function to get a new idle destination
    const chooseNewIdleDestination = useCallback(() => {
        const currentPos = groupRef.current?.position;
        if (!currentPos) return null;

        let newDest: THREE.Vector3;
        do {
            newDest = getRandomItem(IDLE_DESTINATIONS).clone();
            newDest.y = TOTAL_HEIGHT / 2; // Ensure destination is on the ground plane (for pathfinding)
        } while (newDest.distanceTo(currentPos) < 1 && IDLE_DESTINATIONS.length > 1); // Don't pick same spot

        // Check destination registry for conflicts and get an available spot
        return findAvailableDestination(newDest, id);
    }, [id]);

    // Adjusted waiting times
    const getRandomWaitTime = useCallback(() => {
        // Wait 4-8 seconds at idle spots
        return Math.random() * 4 + 4;
    }, []);

    // Prepare path finding with original path storage
    // Pass goingToDesk flag explicitly to avoid stale closure issues
    const findAndSetPath = useCallback((
        startPos: THREE.Vector3,
        endPos: THREE.Vector3,
        goingToDesk: boolean = false
    ) => {
        // For desk destinations, don't offset as each employee has a dedicated desk
        const finalDestination = goingToDesk ? endPos : findAvailableDestination(endPos, id);

        const newPath = findPathAStar(startPos, finalDestination);

        if (newPath) {
            // If going to desk, append the exact desk position as the final waypoint
            // This is needed because pathfinding might stop at the nearest walkable cell
            // (desk positions are often inside the obstacle padding zone)
            if (goingToDesk && newPath.length > 0) {
                const lastPoint = newPath[newPath.length - 1];
                // Only add if the path doesn't already end at the desk
                if (lastPoint.distanceTo(endPos) > 0.1) {
                    newPath.push(endPos.clone());
                }
            }

            // Store the complete original path for visualization
            setOriginalPath(newPath.map(p => p.clone())); // Deep clone to prevent modification

            // Set the active path for movement
            setPath(newPath);
            setPathIndex(0);
        }

        return newPath;
    }, [id]);

    useFrame((state, delta) => {
        if (!groupRef.current) return;

        const currentPos = groupRef.current.position;
        const desiredY = TOTAL_HEIGHT / 2;
        currentPos.y = desiredY; // Keep employee on the ground

        let targetPathNode: THREE.Vector3 | null = null;
        let isMoving = false;

        // Determine if employee should be at desk
        // They go to desk if:
        // 1. They are busy
        // 2. They are the CEO
        // 3. They don't want to wander
        const shouldBeAtDesk = isBusy || isCEO || !wantsToWander;

        // Track shouldBeAtDesk state (for internal logic, no logging)
        shouldBeAtDeskRef.current = shouldBeAtDesk;

        if (shouldBeAtDesk) {
            // Going back to desk logic
            // Only update state if it's actually different to avoid re-renders
            if (idleState !== 'wandering') {
                setIdleState('wandering'); // Reset idle state so they are ready to wander if condition changes
            }
            idleTimerRef.current = 0;

            const deskPosition = initialPositionRef.current;
            const distanceToDesk = currentPos.distanceTo(deskPosition);

            if (distanceToDesk > arrivalThreshold) {
                // Need to path to desk if:
                // 1. No path exists, OR
                // 2. We have a path but it's not going to the desk
                const needsNewPath = !path || !isGoingToDesk;

                if (needsNewPath) {
                    if (!isGoingToDesk) {
                        setIsGoingToDesk(true);
                    }
                    // Pass true explicitly for goingToDesk to avoid stale closure
                    findAndSetPath(currentPos.clone(), deskPosition.clone(), true);
                    setCurrentDestination(deskPosition);
                }

                if (path && pathIndex < path.length) {
                    targetPathNode = path[pathIndex];
                    isMoving = true;
                }
            } else {
                // At desk - clear paths and reset flags
                if (path) {
                    setPath(null);
                    setOriginalPath(null);
                    // Release destination when arrived
                    releaseEmployeeReservations(id);
                }
                if (isGoingToDesk) {
                    setIsGoingToDesk(false);
                }
                if (currentDestination !== null) {
                    setCurrentDestination(null);
                }
                // Snap/Lerp to exact desk position
                if (currentPos.distanceTo(deskPosition) > 0.01) currentPos.lerp(deskPosition, 0.1);
            }
        } else {
            // --- IDLE LOGIC (Wandering) --- 
            // Only runs if !shouldBeAtDesk (i.e. not busy, not CEO, and wants to wander)
            if (idleState === 'wandering') {
                if (!path) {
                    const newDest = chooseNewIdleDestination();
                    if (newDest) {
                        // console.log(`Employee ${id} (${name}) is idle, pathing to new destination`);
                        if (isGoingToDesk) {
                            setIsGoingToDesk(false); // Only update if different
                        }
                        const newPath = findAndSetPath(currentPos, newDest);
                        setCurrentDestination(newDest);
                        if (!newPath) console.warn(`Employee ${id} could not find path to new destination.`);
                    }
                } else {
                    if (pathIndex < path.length) {
                        targetPathNode = path[pathIndex];
                        isMoving = true;
                    } else {
                        // console.log(`Employee ${id} (${name}) reached idle destination, waiting...`);
                        setPath(null);
                        setOriginalPath(null); // Also clear original path when destination reached
                        setCurrentDestination(null);
                        setIdleState('waiting');
                        idleTimerRef.current = getRandomWaitTime(); // Use ref instead of state
                        // Don't release the reservation yet, as employee is still occupying the spot
                    }
                }
            } else if (idleState === 'waiting') {
                idleTimerRef.current = Math.max(0, idleTimerRef.current - delta);
                if (idleTimerRef.current <= 0) {
                    // console.log(`Employee ${id} (${name}) finished waiting, wandering again.`);
                    // Release destination when leaving
                    releaseEmployeeReservations(id);
                    setIdleState('wandering');
                }
            }
        }

        // --- MOVEMENT LOGIC ---
        if (isMoving && targetPathNode) {
            targetPathNode = targetPathNode.clone();
            targetPathNode.y = desiredY;

            const direction = new THREE.Vector3().subVectors(targetPathNode, currentPos);
            const distance = direction.length();

            if (distance < arrivalThreshold) {
                setPathIndex(prev => prev + 1);
            } else {
                direction.normalize();
                const moveDistance = movementSpeed * delta;
                groupRef.current.position.add(direction.multiplyScalar(Math.min(moveDistance, distance)));
            }
        }

        // --- DEBUG PATH VISUALIZATION (throttled) ---
        // Only update debug visualization every 500ms to avoid performance issues
        // Use refs to track previous values and avoid unnecessary state updates
        if (debugMode && groupRef.current && path && path.length > 0) {
            const now = performance.now();
            if (now - debugPathUpdateRef.current > 500) {
                debugPathUpdateRef.current = now;

                // Only update if we have a valid path to show
                const currentPosClone = groupRef.current.position.clone();
                const newRemainPath = path.length > pathIndex
                    ? [currentPosClone, ...path.slice(pathIndex)]
                    : null;

                // Only update state if we have path data
                if (newRemainPath && newRemainPath.length > 1) {
                    setDebugPathData(prev => {
                        // Skip update if path length hasn't changed significantly
                        if (prev.remainingPath?.length === newRemainPath.length) {
                            return prev; // Return same reference to avoid re-render
                        }
                        return {
                            originalPath: null, // Don't track original path to reduce updates
                            remainingPath: newRemainPath,
                        };
                    });
                }
            }
        }
    });

    // Clear debug data when debug mode is turned off
    useEffect(() => {
        if (!debugMode) {
            setDebugPathData({ originalPath: null, remainingPath: null });
        }
    }, [debugMode]);

    // Generate status based on current state and notifications
    // Notifications take priority if present, showing the most severe indicator
    const { currentStatus, effectiveNotificationCount } = useMemo(() => {
        // If employee has pending notifications, show indicator based on highest priority
        if (notificationCount > 0 && notificationPriority > 0) {
            let indicatorStatus: StatusType = 'info';
            if (notificationPriority === 3) {
                indicatorStatus = 'warning'; // critical → red warning
            } else if (notificationPriority === 2) {
                indicatorStatus = 'question'; // warning → yellow question
            }
            // priority 1 = info (blue)
            return { currentStatus: indicatorStatus, effectiveNotificationCount: notificationCount };
        }

        // Use provided status if available and valid
        if (status && status !== 'none') {
            return { currentStatus: status, effectiveNotificationCount: 0 };
        }

        // Or generate based on state
        if (isBusy) {
            return { currentStatus: 'info' as StatusType, effectiveNotificationCount: 0 };
        }
        return { currentStatus: 'none' as StatusType, effectiveNotificationCount: 0 };
    }, [status, isBusy, notificationCount, notificationPriority]);

    const baseY = -TOTAL_HEIGHT / 2;

    // Define context menu actions for employees
    const employeeActions = useMemo(() => [
        {
            id: 'chat',
            label: 'Chat',
            icon: MessageSquare,
            color: 'blue',
            position: 'top' as const,
            onClick: () => {
                onClick();
            }
        },
        {
            id: 'view-pc',
            label: 'View PC',
            icon: Monitor,
            color: 'green',
            position: 'right' as const,
            onClick: () => {
                setViewComputerEmployeeId(id);
            }
        },
        {
            id: 'manage',
            label: 'Manage',
            icon: UserCog,
            color: 'amber',
            position: 'bottom' as const,
            onClick: () => {
                setManageAgentEmployeeId(id);
            }
        },
        {
            id: 'task-status',
            label: 'Tasks & Status',
            icon: CheckSquare,
            color: 'purple',
            position: 'left' as const,
            onClick: () => {
                setTaskStatusEmployeeId(id);
            }
        },
        {
            id: 'training',
            label: 'Training',
            icon: Book,
            color: 'indigo',
            // position: undefined, // Will be auto-calculated by updated ContextMenu
            onClick: () => {
                setTrainingEmployeeId(id);
            }
        }
    ], [name, onClick, id, setManageAgentEmployeeId, setTrainingEmployeeId, setViewComputerEmployeeId, setTaskStatusEmployeeId]);

    // Handle click for selection - close other menus and toggle this one
    const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        // If already selected, deselect. Otherwise, select this one (closing any other)
        if (isSelected) {
            setSelectedObjectId(null);
        } else {
            setSelectedObjectId(employeeIdString);
        }
    }, [isSelected, setSelectedObjectId, employeeIdString]);

    // Hover scale animation
    const hoverScale = isHovered && !isSelected ? 1.05 : 1.0;
    useFrame(() => {
        if (groupRef.current) {
            const targetScale = new THREE.Vector3(hoverScale, hoverScale, hoverScale);
            groupRef.current.scale.lerp(targetScale, 0.1);
        }
    });

    // The employee body + debug visualizations
    return (
        <>
            <group
                ref={groupRef}
                name={`employee-${id}`}
                castShadow
                onClick={handleClick}
                onPointerEnter={(e) => { e.stopPropagation(); setIsHovered(true); }}
                onPointerLeave={(e) => { e.stopPropagation(); setIsHovered(false); }}
            >
                {/* Legs */}
                <Box args={[BODY_WIDTH, LEG_HEIGHT, BODY_WIDTH * 0.6]} position={[0, baseY + LEG_HEIGHT / 2, 0]} castShadow>
                    <meshStandardMaterial color={finalColors.pants} />
                </Box>
                {/* Body */}
                <Box args={[BODY_WIDTH, BODY_HEIGHT, BODY_WIDTH * 0.6]} position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT / 2, 0]} castShadow>
                    <meshStandardMaterial color={finalColors.shirt} />
                </Box>
                {/* Head - with optional profile image overlay for expert imports */}
                {profileImageUrl && profileImageUrl.trim().length > 0 ? (
                    <ProfileHead
                        imageUrl={profileImageUrl}
                        position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT / 2, 0]}
                        skinColor={finalColors.skin}
                        hairColor={finalColors.hair}
                    />
                ) : (
                    <Box args={[HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH]} position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT / 2, 0]} castShadow>
                        <meshStandardMaterial color={finalColors.skin} />
                    </Box>
                )}
                {/* Hair */}
                <group position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT + HAIR_HEIGHT / 2, 0]}>
                    <Box args={[HAIR_WIDTH, HAIR_HEIGHT, HAIR_WIDTH]} castShadow>
                        <meshStandardMaterial color={finalColors.hair} />
                    </Box>

                    {/* Propeller Hat for Supervisors */}
                    {isSupervisor && <PropellerHat />}
                </group>

                {/* Selection Highlight */}
                {(isHovered || isSelected) && (
                    <Edges
                        scale={1.1}
                        color={isSelected ? "#00ff00" : "#ffffff"}
                        lineWidth={isSelected ? 2 : 1}
                    />
                )}

                {/* Status Indicator - above hair */}
                <StatusIndicator
                    status={currentStatus}
                    message={statusMessage}
                    visible={currentStatus !== 'none'}
                    notificationCount={effectiveNotificationCount}
                />

                {/* Employee Label - Show on hover or when highlighted */}
                {(isHovered || isHighlighted) && (
                    <Html
                        position={[0, TOTAL_HEIGHT + 0.5, 0]}
                        center
                        zIndexRange={[100, 0]}
                        style={{
                            pointerEvents: 'none',
                            userSelect: 'none',
                        }}
                    >
                        <div className="animate-in fade-in zoom-in-95 duration-200">
                            <div className={`px-3 py-1.5 rounded-md text-xs font-medium shadow-lg whitespace-nowrap ${isHighlighted
                                ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                                : 'bg-foreground text-background'
                                }`}>
                                <div className="font-semibold">{name}</div>
                                {jobTitle && (
                                    <div className="text-[10px] opacity-80 mt-0.5">{jobTitle}</div>
                                )}
                                {team && (
                                    <div className="text-[10px] opacity-60 mt-0.5">{team}</div>
                                )}
                            </div>
                        </div>
                    </Html>
                )}

                {/* Context Menu */}
                <ContextMenu
                    isOpen={isSelected}
                    onClose={() => setSelectedObjectId(null)}
                    actions={employeeActions}
                    title={name}
                />
            </group>

            {/* Path Visualization - Outside employee group to use world coords */}
            {/* Throttled to update every 200ms to avoid performance issues */}
            {debugMode && (debugPathData.originalPath || debugPathData.remainingPath) && (
                <PathVisualizer
                    originalPath={debugPathData.originalPath}
                    remainingPath={debugPathData.remainingPath}
                    isGoingToDesk={isGoingToDesk}
                    employeeId={id}
                />
            )}
        </>
    );
});

export { Employee };
