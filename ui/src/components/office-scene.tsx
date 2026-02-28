'use client';

import { Box, OrbitControls } from '@react-three/drei';
import { useMemo, memo, useRef, useEffect, createRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { useAppStore } from '@/lib/app-store';
import { useChatActions } from '@/features/chat-system';
import { useObjectRegistrationStore } from '@/features/office-system/store/object-registration-store';
import { Employee } from '@/features/office-system/components/employee';
import Desk from '@/features/office-system/components/desk';
import TeamCluster from '@/features/office-system/components/team-cluster';
import Plant from '@/features/office-system/components/plant';
import Couch from '@/features/office-system/components/couch';
import Bookshelf from '@/features/office-system/components/bookshelf';
import Pantry from '@/features/office-system/components/pantry';
import CustomMeshObject from '@/features/office-system/components/custom-mesh-object';
import {
    WALL_THICKNESS,
    WALL_HEIGHT,
    FLOOR_SIZE,
    HALF_FLOOR,
} from '@/constants';
import { getOfficeTheme } from '@/config/office-theme';
import { initializeGrid } from '@/features/nav-system/pathfinding/a-star-pathfinding';
import { SmartGrid } from './debug/unified-grid-helper';
import { DestinationDebugger } from './debug/destination-debugger';
import type { StatusType } from '@/features/nav-system/components/status-indicator';
import GlassWall from '@/features/office-system/components/glass-wall';
import type { EmployeeData, DeskLayoutData, TeamData, OfficeObject, OfficeId } from '@/lib/types';
import { getAbsoluteDeskPosition, getDeskRotation } from '@/convex/utils/layout';

import { PlacementHandler } from './placement-handler';
import { ViewComputerDialog } from '@/features/remote-cua-system/components/view-computer-dialog';

/**
 * @file components/office-scene.tsx
 * The main 3D office scene component.
 * 
 * Handles rendering of the office environment, employees, and interactive objects.
 * Uses @react-three/fiber for the 3D canvas and Zustand stores for state management.
 */

// Helper to convert CSS color variable to THREE.Color
function getCSSColor(variable: string): THREE.Color {
    if (typeof window === 'undefined') return new THREE.Color('#cccccc');

    const root = document.documentElement;
    const value = getComputedStyle(root).getPropertyValue(variable).trim();

    // Parse oklch format: oklch(L C H)
    if (value.startsWith('oklch')) {
        const match = value.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
        if (match) {
            const [, l, c, h] = match;
            // Convert OKLCH to RGB (approximate conversion)
            // For simplicity, we'll use a basic conversion
            // In production, you'd want a proper color space conversion library
            const lightness = parseFloat(l);
            const chroma = parseFloat(c);
            const hue = parseFloat(h);

            // Simple approximation: convert to HSL-like values
            const s = chroma * 100;
            const hslH = hue;
            const hslL = lightness * 100;

            return new THREE.Color().setHSL(hslH / 360, s / 100, hslL / 100);
        }
    }

    // Fallback to direct color value if not oklch
    return new THREE.Color(value || '#cccccc');
}

// Sample status messages
const SAMPLE_MESSAGES = [
    'Working on task...',
    'Analyzing data',
    'Writing report',
    'In a meeting',
    'Taking a break',
    'Debugging code',
    'Planning sprint',
    'Reviewing PR',
    'On a call',
];

// Simple hash function to generate deterministic "random" values from employee ID
// This ensures the same employee always gets the same wander/status preference
function hashString(str: string): number {
    if (!str || str.length === 0) return 0;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

// Seeded random number generator based on employee ID
function seededRandom(seed: string, offset: number = 0): number {
    if (!seed) return 0.5; // Default to 50% if no seed
    const hash = hashString(seed + offset.toString());
    return (hash % 1000) / 1000; // Returns 0-1
}

// Helper function to assign random statuses to some employees
// Also respects team wander locks - when a team has an active lock, employees stay at desks
// Uses deterministic "random" based on employee ID to prevent re-randomizing on every render
function assignRandomStatuses(
    employees: EmployeeData[],
    teamWanderLocks: Map<string, number | undefined>
): EmployeeData[] {
    // Update status types - 'message' is no longer a status type
    const statusTypes: StatusType[] = ['info', 'success', 'question', 'warning'];
    const now = Date.now();

    return employees.map((emp) => {
        // Check if employee's team has an active wander lock
        const teamLockUntil = teamWanderLocks.get(emp.teamId);
        const isTeamLocked = teamLockUntil !== undefined && teamLockUntil > now;

        // CEO always has 'info' status with a message
        if (emp.builtInRole === 'ceo') {
            return {
                ...emp,
                status: 'info' as StatusType,
                statusMessage: emp.statusMessage || 'Managing the team',
                wantsToWander: false, // CEO never wanders
            };
        }

        // Use deterministic random based on employee ID
        // This ensures stable values that don't change on re-renders
        const wanderRandom = seededRandom(emp._id, 1);
        const statusRandom = seededRandom(emp._id, 2);
        const statusTypeRandom = seededRandom(emp._id, 3);
        const messageRandom = seededRandom(emp._id, 4);
        const messageIndexRandom = seededRandom(emp._id, 5);

        // If team is locked, force employees to stay at desk
        // Otherwise, use deterministic "random" (50% chance based on ID)
        const wantsToWander = isTeamLocked ? false : wanderRandom < 0.5;

        // Give ~60% of employees a random status (deterministic per employee)
        if (statusRandom < 0.6) {
            const randomStatus =
                statusTypes[Math.floor(statusTypeRandom * statusTypes.length)];

            // Give 75% of employees with status a message too
            const shouldHaveMessage = messageRandom < 0.75;
            const randomMessage = shouldHaveMessage
                ? SAMPLE_MESSAGES[Math.floor(messageIndexRandom * SAMPLE_MESSAGES.length)]
                : emp.statusMessage;

            return {
                ...emp,
                status: randomStatus as StatusType,
                statusMessage: randomMessage || emp.statusMessage,
                wantsToWander,
            };
        }

        // Return with existing status unchanged but add wander preference
        return {
            ...emp,
            wantsToWander,
        };
    });
}

interface SceneContentsProps {
    teams: TeamData[];
    employees: EmployeeData[];
    desks: DeskLayoutData[];
    officeObjects: OfficeObject[];
    companyId?: OfficeId<"companies">; // Add companyId for drag-and-drop functionality
}

const SceneContents = ({
    teams,
    employees,
    desks,
    officeObjects: allOfficeObjects,
    companyId,
}: SceneContentsProps) => {
    const enableOfficeObjects = import.meta.env.VITE_ENABLE_OFFICE_OBJECTS !== "false";
    // Use real store hooks with selectors to prevent unnecessary re-renders
    const isBuilderMode = useAppStore(state => state.isBuilderMode);
    const debugMode = useAppStore(state => state.debugMode);
    const setActiveChatParticipant = useAppStore(state => state.setActiveChatParticipant);
    const isAnimatingCamera = useAppStore(state => state.isAnimatingCamera);
    const setAnimatingCamera = useAppStore(state => state.setAnimatingCamera);
    const isDragging = useAppStore(state => state.isDragging);
    const placementMode = useAppStore(state => state.placementMode);
    const setSelectedObjectId = useAppStore(state => state.setSelectedObjectId);

    const { openEmployeeChat } = useChatActions();
    const setIsTeamPanelOpen = useAppStore(state => state.setIsTeamPanelOpen);
    const setActiveTeamId = useAppStore(state => state.setActiveTeamId);
    const setSelectedTeamId = useAppStore(state => state.setSelectedTeamId);
    const setSelectedProjectId = useAppStore(state => state.setSelectedProjectId);
    const setKanbanFocusAgentId = useAppStore(state => state.setKanbanFocusAgentId);

    const registerObject = useObjectRegistrationStore(state => state.registerObject);
    const unregisterObject = useObjectRegistrationStore(state => state.unregisterObject);
    const getObjects = useObjectRegistrationStore(state => state.getObjects);

    // Detect if we're in dark mode for lighting/background adjustments.
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const root = document.documentElement;
            setIsDarkMode(root.classList.contains('dark'));

            const observer = new MutationObserver(() => {
                setIsDarkMode(root.classList.contains('dark'));
            });

            observer.observe(root, { attributes: true, attributeFilter: ['class'] });
            return () => observer.disconnect();
        }
    }, []);

    const officeTheme = useMemo(() => getOfficeTheme(isDarkMode), [isDarkMode]);

    // Use animation state to prevent scene updates during transitions
    const sceneBuilderMode = isAnimatingCamera ? false : isBuilderMode;

    const orbitControlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null);
    const floorRef = useRef<THREE.Mesh>(null);
    const ceoDeskRef = useRef<THREE.Group>(null);

    const ceoAnchorFromGlassWalls = useMemo<[number, number, number]>(() => {
        const glassWalls = (allOfficeObjects ?? []).filter((obj) => obj.meshType === "glass-wall");
        if (glassWalls.length === 0) return [0, 0, 15];
        const avgX = glassWalls.reduce((sum, wall) => sum + wall.position[0], 0) / glassWalls.length;
        const maxZ = glassWalls.reduce((max, wall) => Math.max(max, wall.position[2]), -Infinity);
        const x = Number.isFinite(avgX) ? avgX : 0;
        const z = Number.isFinite(maxZ) ? maxZ : 15;
        return [Math.max(-HALF_FLOOR + 2, Math.min(HALF_FLOOR - 2, x)), 0, Math.max(-HALF_FLOOR + 2, Math.min(HALF_FLOOR - 2, z))];
    }, [allOfficeObjects]);

    // Create refs for office objects - we'll collect these for obstacle detection
    const officeObjectRefs = useRef<Map<string, React.RefObject<THREE.Group | null>>>(new Map());

    const handleEmployeeClick = useCallback(
        async (employee: EmployeeData) => {
            if (useAppStore.getState().placementMode.active) return;
            if (!employee.companyId) return;

            setActiveChatParticipant({
                type: 'employee',
                companyId: employee.companyId,
                employeeId: employee._id,
                teamId: employee.teamId,
                builtInRole: employee.builtInRole
            });
            await openEmployeeChat(employee._id, true);
        },
        [setActiveChatParticipant, openEmployeeChat],
    );

    const handleTeamClick = useCallback(
        async (team: TeamData) => {
            if (useAppStore.getState().placementMode.active) return;

            if (!team.companyId) {
                console.error('Team has no company:', team);
                return;
            }

            // Open team panel instead of chat
            setActiveTeamId(team._id);
            setSelectedTeamId(team._id);
            if (String(team._id).startsWith("team-")) {
                setSelectedProjectId(String(team._id).replace(/^team-/, ""));
            }
            setKanbanFocusAgentId(null);
            setIsTeamPanelOpen(true);
        },
        [setActiveTeamId, setIsTeamPanelOpen, setKanbanFocusAgentId, setSelectedProjectId, setSelectedTeamId],
    );

    // const desksByTeam = useMemo(() => {
    //     const grouped: Record<string, Array<DeskLayoutData>> = {};
    //     for (const desk of desks) {
    //         // Skip Management team desks - they're rendered separately as CEO desk
    //         if (desk.team === 'Management') continue;
    //         if (!grouped[desk.team]) {
    //             grouped[desk.team] = [];
    //         }
    //         grouped[desk.team].push(desk);
    //     }
    //     return grouped;
    // }, [desks]);

    // Find CEO desk (Management team) and calculate its position dynamically
    const ceoDeskData = useMemo(() => {
        const ceoDesk = desks.find((d) => d.team === 'Management' || d.id === 'ceo-desk');
        if (!ceoDesk) return null;

        // Find Management team to get cluster position
        const managementTeam = teams.find(t => t.name === 'Management');
        if (!managementTeam) return null;

        // Get all Management team desks to calculate total count
        const managementDesks = desks.filter(d => d.team === 'Management');
        const clusterPosition = managementTeam.clusterPosition || ceoAnchorFromGlassWalls;

        // Calculate position dynamically (relative to cluster position)
        const position = getAbsoluteDeskPosition(
            clusterPosition,
            ceoDesk.deskIndex,
            managementDesks.length
        );
        const rotationY = getDeskRotation(ceoDesk.deskIndex, managementDesks.length);

        return {
            ...ceoDesk,
            position,
            rotationY,
        };
    }, [desks, teams, ceoAnchorFromGlassWalls]);

    const officeObjectIdsString = useMemo(() => {
        if (!allOfficeObjects) return '';
        return allOfficeObjects.map((obj) => obj._id).join(',');
    }, [allOfficeObjects])

    // Render office objects with refs for obstacle collection
    // Only renders when new objects are added to the scene
    const officeObjectsRendered = useMemo(() => {
        if (!allOfficeObjects) return null;
        return allOfficeObjects.map((obj) => {
            // Create or get ref for this object
            if (!officeObjectRefs.current.has(obj._id)) {
                officeObjectRefs.current.set(obj._id, createRef<THREE.Group>());
            }
            const objRef = officeObjectRefs.current.get(obj._id)!;

            // Callback ref to register object when mounted
            const setRef = (el: THREE.Group | null) => {
                // Update the React ref
                (objRef as React.MutableRefObject<THREE.Group | null>).current = el;

                // Register with store
                if (el) {
                    registerObject(obj._id, el);
                } else {
                    unregisterObject(obj._id);
                }
            };

            switch (obj.meshType) {
                case 'plant':
                    return (
                        <group key={obj._id} ref={setRef} name={`obstacle-plant-${obj._id}`}>
                            <Plant
                                objectId={obj._id}
                                position={obj.position as [number, number, number]}
                                rotation={obj.rotation as [number, number, number]}
                                companyId={companyId}
                            />
                        </group>
                    );

                case 'couch':
                    return (
                        <group key={obj._id} ref={setRef} name={`obstacle-couch-${obj._id}`}>
                            <Couch
                                objectId={obj._id}
                                position={obj.position as [number, number, number]}
                                rotation={obj.rotation as [number, number, number]}
                                companyId={companyId}
                            />
                        </group>
                    );

                case 'bookshelf':
                    return (
                        <group key={obj._id} ref={setRef} name={`obstacle-bookshelf-${obj._id}`}>
                            <Bookshelf
                                objectId={obj._id}
                                position={obj.position as [number, number, number]}
                                rotation={obj.rotation as [number, number, number]}
                                companyId={companyId}
                            />
                        </group>
                    );

                case 'pantry':
                    return (
                        <group key={obj._id} ref={setRef} name={`obstacle-pantry-${obj._id}`}>
                            <Pantry
                                objectId={obj._id}
                                position={obj.position as [number, number, number]}
                                rotation={obj.rotation as [number, number, number]}
                                companyId={companyId}
                            />
                        </group>
                    );

                case 'team-cluster':
                    // Team clusters need special handling with teams/desks data
                    const team = teams.find(t => t._id === obj.metadata?.teamId);
                    const teamDesks = desks.filter(d => d.team === team?.name);

                    if (!team) return null;

                    return (
                        <group key={obj._id} ref={setRef} name={`obstacle-cluster-${team.name}`}>
                            <TeamCluster
                                team={team}
                                desks={teamDesks}
                                handleTeamClick={handleTeamClick}
                                companyId={companyId}
                                objectId={obj._id}
                                position={obj.position as [number, number, number]}
                                rotation={obj.rotation as [number, number, number]}
                            />
                        </group>
                    );

                case 'glass-wall':
                    console.log("Rendering glass wall Kenji", obj.position)
                    return (
                        <group key={obj._id} ref={setRef} name={`obstacle-glass-wall-${obj._id}`}>
                            <GlassWall
                                objectId={obj._id}
                                position={obj.position as [number, number, number]}
                                rotation={obj.rotation as [number, number, number]}
                                companyId={companyId}
                            />
                        </group>
                    )

                case 'custom-mesh':
                    return (
                        <group key={obj._id} ref={setRef} name={`obstacle-custom-mesh-${obj._id}`}>
                            <CustomMeshObject
                                objectId={obj._id}
                                position={obj.position as [number, number, number]}
                                rotation={obj.rotation as [number, number, number]}
                                scale={obj.scale as [number, number, number] | undefined}
                                companyId={companyId}
                                meshUrl={typeof obj.metadata?.meshPublicPath === "string" ? obj.metadata.meshPublicPath : ""}
                                label={typeof obj.metadata?.displayName === "string" ? obj.metadata.displayName : undefined}
                            />
                        </group>
                    );

                default:
                    console.warn(`Unknown meshType: ${obj.meshType}`);
                    return null;
            }
        });
    }, [allOfficeObjects, officeObjectIdsString, teams, desks, handleTeamClick, companyId, registerObject, unregisterObject]);

    // Register CEO desk
    useEffect(() => {
        if (ceoDeskRef.current) {
            registerObject('ceo-desk', ceoDeskRef.current);
        }
        return () => unregisterObject('ceo-desk');
    }, [registerObject, unregisterObject]);

    // Initialize grid when objects change
    // Use a timeout to debounce and ensure all objects are registered
    useEffect(() => {
        const timer = setTimeout(() => {
            const objects = getObjects();
            const expectedCount = (allOfficeObjects?.length || 0) + (ceoDeskData ? 1 : 0);

            // Only initialize if we have objects (if expected)
            if (expectedCount > 0 && objects.length > 0) {
                console.log('Initializing grid with registered objects:', objects.length);
                initializeGrid(FLOOR_SIZE, objects, 2, 3);
            } else if (expectedCount === 0) {
                // Initialize empty grid if no obstacles expected
                initializeGrid(FLOOR_SIZE, [], 2, 3);
            }
        }, 500); // 500ms debounce to let all components mount/register

        return () => clearTimeout(timer);
    }, [allOfficeObjects?.length, ceoDeskData, getObjects]); // Re-run when expected count changes

    // Camera animation when builder mode changes
    useEffect(() => {
        if (orbitControlsRef.current) {
            const controls = orbitControlsRef.current;
            const camera = controls.object;

            if (isBuilderMode) {
                // Smooth transition to top-down view for builder mode
                const startPos = camera.position.clone();
                const endPos = new THREE.Vector3(0, 50, 0);
                const duration = 500; // ms
                const startTime = performance.now();

                const animateCamera = () => {
                    const elapsed = performance.now() - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

                    camera.position.lerpVectors(startPos, endPos, eased);
                    camera.lookAt(0, 0, 0);
                    camera.updateProjectionMatrix();
                    controls.update();

                    if (progress < 1) {
                        requestAnimationFrame(animateCamera);
                    } else {
                        // Animation complete - now activate delayed builder mode
                        setAnimatingCamera(false);
                    }
                };

                animateCamera();
            } else {
                // Smooth transition back to standard perspective view
                const startPos = camera.position.clone();
                const endPos = new THREE.Vector3(0, 25, 30);
                const duration = 500; // ms
                const startTime = performance.now();

                const animateCamera = () => {
                    const elapsed = performance.now() - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

                    camera.position.lerpVectors(startPos, endPos, eased);
                    camera.lookAt(0, 0, 0);
                    camera.updateProjectionMatrix();
                    controls.update();

                    if (progress < 1) {
                        requestAnimationFrame(animateCamera);
                    } else {
                        // Animation complete - now deactivate delayed builder mode
                        setAnimatingCamera(false);
                    }
                };

                animateCamera();
            }
        }
    }, [isBuilderMode, setAnimatingCamera]);

    // Build map of team wander locks for reactive updates
    const teamWanderLocks = useMemo(() => {
        const locks = new Map<string, number | undefined>();
        for (const team of teams) {
            locks.set(team._id, team.wanderLockUntil);
        }
        return locks;
    }, [teams]);

    const employeesForScene = useMemo(() => {
        // Assign random statuses to some employees
        // Also respects team wander locks
        const employeesWithStatus = assignRandomStatuses(employees, teamWanderLocks);

        return employeesWithStatus.map((emp) => ({
            ...emp,
            position: emp.initialPosition,
        }));
    }, [employees, teamWanderLocks]);

    // Handle clicking on floor/walls to close context menu
    const handleBackgroundClick = useCallback((e: ThreeEvent<MouseEvent>) => {
        // Only close if not in placement mode and not dragging
        if (!placementMode.active && !isDragging) {
            e.stopPropagation();
            setSelectedObjectId(null);
        }
    }, [placementMode.active, isDragging, setSelectedObjectId]);

    const OfficeContainer = useMemo(() => {
        return <>
            <Box
                ref={floorRef}
                args={[FLOOR_SIZE, WALL_THICKNESS, FLOOR_SIZE]}
                position={[0, -WALL_THICKNESS / 2, 0]}
                receiveShadow
                name="floor"
                onClick={handleBackgroundClick}
            >
                <meshStandardMaterial color={officeTheme.scene.floor} />
            </Box>

            <Box
                args={[FLOOR_SIZE, WALL_HEIGHT, WALL_THICKNESS]}
                position={[0, WALL_HEIGHT / 2, -HALF_FLOOR]}
                castShadow
                receiveShadow
                name="wall-back"
                onClick={handleBackgroundClick}
            >
                <meshStandardMaterial color={officeTheme.scene.walls} />
            </Box>
            <Box
                args={[FLOOR_SIZE, WALL_HEIGHT, WALL_THICKNESS]}
                position={[0, WALL_HEIGHT / 2, HALF_FLOOR]}
                castShadow
                receiveShadow
                name="wall-front"
                onClick={handleBackgroundClick}
            >
                <meshStandardMaterial color={officeTheme.scene.walls} />
            </Box>
            <Box
                args={[WALL_THICKNESS, WALL_HEIGHT, FLOOR_SIZE + WALL_THICKNESS]}
                position={[-HALF_FLOOR, WALL_HEIGHT / 2, 0]}
                castShadow
                receiveShadow
                name="wall-left"
                onClick={handleBackgroundClick}
            >
                <meshStandardMaterial color={officeTheme.scene.walls} />
            </Box>
            <Box
                args={[WALL_THICKNESS, WALL_HEIGHT, FLOOR_SIZE + WALL_THICKNESS]}
                position={[HALF_FLOOR, WALL_HEIGHT / 2, 0]}
                castShadow
                receiveShadow
                name="wall-right"
                onClick={handleBackgroundClick}
            >
                <meshStandardMaterial color={officeTheme.scene.walls} />
            </Box>

        </>
    }, [officeTheme.scene.floor, officeTheme.scene.walls, handleBackgroundClick])

    return (
        <>
            {/* Ambient lighting - pure white everywhere */}
            <ambientLight
                intensity={0.9}
                color={officeTheme.lighting.ambient}
            />

            {/* Main directional light - bright and clean */}
            <directionalLight
                position={[0, 20, 5]}
                intensity={1.5}
                color={officeTheme.lighting.directional}
                castShadow
                shadow-mapSize-width={sceneBuilderMode ? 1024 : 2048}
                shadow-mapSize-height={sceneBuilderMode ? 1024 : 2048}
                shadow-camera-far={50}
                shadow-camera-left={-HALF_FLOOR - 5}
                shadow-camera-right={HALF_FLOOR + 5}
                shadow-camera-top={HALF_FLOOR + 5}
                shadow-camera-bottom={-HALF_FLOOR - 5}
            />

            {/* Accent point lights - subtle cool white fill */}
            <pointLight
                position={[-10, 10, -10]}
                intensity={0.5}
                color={officeTheme.lighting.point}
            />
            <pointLight
                position={[10, 10, 10]}
                intensity={0.5}
                color={officeTheme.lighting.point}
            />

            <OrbitControls
                ref={orbitControlsRef}
                enabled={!isDragging} // Disable controls while dragging an object
                enableRotate={!isDragging} // Always allow rotation
                enablePan={!isDragging} // Always allow panning
                enableZoom={true} // Always allow zoom
                maxPolarAngle={sceneBuilderMode ? Math.PI / 3 : Math.PI} // Limit rotation in builder mode
                minPolarAngle={sceneBuilderMode ? 0 : 0} // Allow looking straight down in builder mode
            />

            {OfficeContainer}

            {ceoDeskData && (
                <group ref={ceoDeskRef} name="obstacle-ceoDeskGroup">
                    <Desk
                        key={ceoDeskData.id}
                        deskId={ceoDeskData.id}
                        position={ceoDeskData.position}
                        rotationY={ceoDeskData.rotationY}
                        isHovered={false}
                    />
                </group>
            )}

            {/* Only render employees when NOT in builder mode for performance */}
            {!sceneBuilderMode && employeesForScene.map((emp) => (
                <Employee
                    key={emp._id}
                    _id={emp._id}
                    name={emp.name}
                    position={emp.initialPosition}
                    isBusy={emp.isBusy}
                    isCEO={emp.isCEO}
                    isSupervisor={emp.isSupervisor}
                    gender={emp.gender}
                    onClick={() => handleEmployeeClick(emp)}
                    debugMode={debugMode}
                    status={(emp.status || 'none') as StatusType}
                    statusMessage={emp.statusMessage}
                    wantsToWander={emp.wantsToWander}
                    jobTitle={emp.jobTitle}
                    team={emp.team}
                    teamId={emp.teamId}
                    notificationCount={emp.notificationCount}
                    notificationPriority={emp.notificationPriority}
                    profileImageUrl={emp.profileImageUrl}
                />
            ))}

            {/* Visual-first safety toggle: object-heavy rendering can be re-enabled once stable. */}
            {enableOfficeObjects ? officeObjectsRendered : null}

            <SmartGrid debugMode={debugMode} isBuilderMode={sceneBuilderMode} placementActive={placementMode.active} />
            {debugMode && <DestinationDebugger />}
            {enableOfficeObjects ? <PlacementHandler /> : null}
        </>
    );
}

const OfficeScene = memo((props: SceneContentsProps) => {
    const [bgColor, setBgColor] = useState(getOfficeTheme(false).scene.background);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const root = document.documentElement;
            const isDark = root.classList.contains('dark');

            setBgColor(getOfficeTheme(isDark).scene.background);

            // Listen for theme changes
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.attributeName === 'class') {
                        setBgColor(getOfficeTheme(root.classList.contains('dark')).scene.background);
                    }
                });
            });

            observer.observe(root, { attributes: true });

            return () => observer.disconnect();
        }
    }, []);

    // View Computer Dialog state
    const viewComputerEmployeeId = useAppStore(state => state.viewComputerEmployeeId);
    const viewComputerInitialProjectId = useAppStore(state => state.viewComputerInitialProjectId);
    const setViewComputerEmployeeId = useAppStore(state => state.setViewComputerEmployeeId);

    return (
        <>
            <Canvas
                shadows
                camera={{ position: [0, 25, 30], fov: 50 }}
                style={{ background: bgColor, transition: 'background 0.3s ease' }}
            >
                <SceneContents {...props} />
            </Canvas>

            {/* View Computer Dialog - Rendered outside Canvas */}
            {viewComputerEmployeeId && (
                <ViewComputerDialog
                    employeeId={viewComputerEmployeeId}
                    open={!!viewComputerEmployeeId}
                    onOpenChange={(open) => {
                        if (!open) {
                            setViewComputerEmployeeId(null);
                        }
                    }}
                    initialProjectId={viewComputerInitialProjectId}
                />
            )}
        </>
    );
});

OfficeScene.displayName = 'OfficeScene';
export default OfficeScene;
