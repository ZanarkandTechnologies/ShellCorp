/**
 * PLACEMENT HANDLER (Renderer)
 * ============================
 * 
 * This component is the "View" layer for the placement system.
 * It is responsible ONLY for:
 * 1. Listening to user input (mouse movement, clicks)
 * 2. Rendering the "Ghost" preview of the object being placed
 * 3. Showing UI feedback (Confirmation Panel, Hints)
 * 
 * ARCHITECTURE:
 * -------------
 * - It does NOT contain game logic. It delegates all actions to `usePlacementSystem`.
 * - It does NOT know what a "Desk" looks like. It asks `getGameObjectDefinition` for the Prefab.
 * - It acts as a bridge between the 3D Scene (Three.js) and the Game System (React/Zustand).
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useThree, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlacementSystem } from "@/features/office-system/systems/placement-system";
import { getGameObjectDefinition } from "@/features/office-system/components/object-registry";
import { AlertCircle } from "lucide-react";
import { FLOOR_SIZE, ROOM_PLACE_MIN, ROOM_PLACE_MAX } from "@/constants";

type PlacementCoordinates = [number, number, number] | null;

export function PlacementHandler() {
    const {
        isActive,
        currentType: type,
        data,
        cancelPlacement,
        confirmCoordinatePlacement,
        confirmTeamAssignment
    } = usePlacementSystem();

    const { raycaster, pointer, camera } = useThree();
    const ghostRef = useRef<THREE.Group>(null);
    const floorPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    const hoverTargetRef = useRef(new THREE.Vector3());
    const hoverPositionRef = useRef<PlacementCoordinates>(null);
    const [pendingPosition, setPendingPosition] = useState<PlacementCoordinates>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const prefab = getGameObjectDefinition(type);
    const GhostComponent = prefab?.Ghost;
    const hasPendingTeamAssignment = Boolean(data && typeof data.pendingTeamId === "string" && data.pendingTeamId);
    const isCoordinatePlacement = isActive && !hasPendingTeamAssignment;

    useEffect(() => {
        if (!isActive) {
            setPendingPosition(null);
            hoverPositionRef.current = null;
            setErrorMessage(null);
            if (ghostRef.current) {
                ghostRef.current.visible = false;
            }
        }
    }, [isActive]);

    useFrame(() => {
        if (!isCoordinatePlacement || pendingPosition) return;

        raycaster.setFromCamera(pointer, camera);
        const target = hoverTargetRef.current;
        if (!raycaster.ray.intersectPlane(floorPlaneRef.current, target)) {
            hoverPositionRef.current = null;
            if (ghostRef.current) {
                ghostRef.current.visible = false;
            }
            return;
        }

        const snap = 1;
        target.x = Math.round(target.x / snap) * snap;
        target.z = Math.round(target.z / snap) * snap;
        target.y = 0;
        target.x = Math.max(ROOM_PLACE_MIN, Math.min(ROOM_PLACE_MAX, target.x));
        target.z = Math.max(ROOM_PLACE_MIN, Math.min(ROOM_PLACE_MAX, target.z));
        hoverPositionRef.current = [target.x, target.y, target.z];

        if (ghostRef.current) {
            ghostRef.current.visible = true;
            ghostRef.current.position.copy(target);
        }
    });

    const handlePlacementSurfaceClick = useCallback((event: ThreeEvent<MouseEvent>) => {
        if (!isCoordinatePlacement || pendingPosition || !hoverPositionRef.current) return;
        event.stopPropagation();
        const [x, y, z] = hoverPositionRef.current;
        const clamped: [number, number, number] = [
            Math.max(ROOM_PLACE_MIN, Math.min(ROOM_PLACE_MAX, x)),
            y,
            Math.max(ROOM_PLACE_MIN, Math.min(ROOM_PLACE_MAX, z)),
        ];
        setPendingPosition(clamped);
    }, [isCoordinatePlacement, pendingPosition]);

    const handleConfirm = async () => {
        setErrorMessage(null);

        try {
            if (hasPendingTeamAssignment && data && typeof data.pendingTeamId === "string") {
                await confirmTeamAssignment(data.pendingTeamId);
                return;
            }

            if (!pendingPosition) return;
            await confirmCoordinatePlacement(new THREE.Vector3(...pendingPosition));
            setPendingPosition(null);
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : "Failed to place object. Please try again.";
            setErrorMessage(errorMsg);
        }
    };

    const handleCancel = () => {
        setPendingPosition(null);
        setErrorMessage(null);
        cancelPlacement();
    };

    if (!isActive || !prefab) return null;

    const confirmMsg: string = typeof prefab.placement.confirmMessage === 'function'
        ? (prefab.placement.confirmMessage(data) as string)
        : (prefab.placement.confirmMessage as string);

    return (
        <group>
            {isCoordinatePlacement && !pendingPosition ? (
                <mesh
                    position={[0, 0.01, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    onClick={handlePlacementSurfaceClick}
                >
                    <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
                    <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>
            ) : null}

            {!hasPendingTeamAssignment && GhostComponent && pendingPosition && (
                <group position={pendingPosition}>
                    <GhostComponent />
                </group>
            )}

            {!hasPendingTeamAssignment && GhostComponent && !pendingPosition && (
                <group ref={ghostRef} visible={false}>
                    <GhostComponent />
                </group>
            )}

            {!hasPendingTeamAssignment && pendingPosition && (
                <Html position={[pendingPosition[0], pendingPosition[1] + 2, pendingPosition[2]]} center>
                    <div className="pointer-events-auto w-64">
                        <Card>
                            <CardHeader>
                                <CardTitle>Confirm Placement</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p>{confirmMsg}</p>
                                <p className="text-xs text-muted-foreground">
                                    {pendingPosition[0].toFixed(1)}, {pendingPosition[2].toFixed(1)}
                                </p>
                                {prefab.placement.hint && (
                                    <p className="text-xs text-yellow-600 mt-2">
                                        {prefab.placement.hint}
                                    </p>
                                )}
                            </CardContent>
                            <CardFooter className="flex justify-between">
                                <Button variant="outline" size="sm" onClick={handleCancel}>
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={handleConfirm}>
                                    Confirm
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </Html>
            )}

            {hasPendingTeamAssignment && (
                <Html position={[0, 3, 0]} center>
                    <div className="pointer-events-auto w-64">
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    {data && typeof data.capacityError === "boolean" && data.capacityError ? 'Team at Capacity' : 'Confirm Placement'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {data && typeof data.capacityError === "boolean" && data.capacityError ? (
                                    <>
                                        <div className="flex items-start gap-2 mb-2">
                                            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="font-medium">Cannot add desk to <strong>{typeof data.teamName === "string" ? data.teamName : "team"}</strong></p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    This team has reached the maximum capacity of {typeof data.maxCapacity === "number" ? data.maxCapacity : "N/A"} desks.
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p>Add {prefab.displayName} to <strong>{data && typeof data.teamName === "string" ? data.teamName : "team"}</strong>?</p>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            This will add a new desk to the team cluster.
                                        </p>
                                        {data && typeof data.remainingSlots === "number" && (
                                            <p className="text-xs text-blue-600 mt-1">
                                                {data.remainingSlots} slot{data.remainingSlots !== 1 ? 's' : ''} remaining after this placement
                                            </p>
                                        )}
                                    </>
                                )}

                                {/* Error Message from backend */}
                                {errorMessage && (
                                    <div className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2">
                                        <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-destructive">{errorMessage}</p>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="flex justify-between">
                                <Button variant="outline" size="sm" onClick={handleCancel}>
                                    {data && typeof data.capacityError === "boolean" && data.capacityError ? 'Close' : 'Cancel'}
                                </Button>
                                {!(data && typeof data.capacityError === "boolean" && data.capacityError) && (
                                    <Button size="sm" onClick={handleConfirm} disabled={!!errorMessage}>
                                        Confirm
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    </div>
                </Html>
            )}
        </group>
    );
}
