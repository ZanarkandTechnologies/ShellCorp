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

import { useState, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlacementSystem } from "@/features/office-system/systems/placement-system";
import { getGameObjectDefinition } from "@/features/office-system/components/object-registry";
import { AlertCircle } from "lucide-react";

export function PlacementHandler() {
    // Use the Game System hook instead of raw store/mutations
    const {
        isActive,
        currentType: type,
        data,
        cancelPlacement,
        confirmCoordinatePlacement,
        confirmTeamAssignment
    } = usePlacementSystem();

    const { raycaster, pointer, camera } = useThree();
    const [hoverPosition, setHoverPosition] = useState<THREE.Vector3 | null>(null);
    const [pendingPosition, setPendingPosition] = useState<THREE.Vector3 | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Get the full Prefab definition (Visuals + Config)
    const prefab = getGameObjectDefinition(type);
    const GhostComponent = prefab?.Ghost;

    // Check if we're waiting for team assignment confirmation (hybrid placement)
    const hasPendingTeamAssignment = Boolean(data && typeof data.pendingTeamId === "string" && data.pendingTeamId);

    // Reset pending position when placement mode changes or becomes inactive
    useEffect(() => {
        if (!isActive) {
            setPendingPosition(null);
            setHoverPosition(null);
            setErrorMessage(null);
        }
    }, [isActive]);

    // Raycast to floor (only for coordinate placement, not team assignment)
    useFrame(() => {
        if (!isActive || pendingPosition || hasPendingTeamAssignment) return;

        raycaster.setFromCamera(pointer, camera);
        // Find floor - assuming floor is at y=0 or we can intersect with a plane
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();

        raycaster.ray.intersectPlane(plane, target);

        if (target) {
            // Snap to grid? Assuming grid size 1 or 2
            const snap = 1;
            target.x = Math.round(target.x / snap) * snap;
            target.z = Math.round(target.z / snap) * snap;
            target.y = 0;

            setHoverPosition(target);
        }
    });

    // Handle click (only for coordinate placement, not team assignment)
    useEffect(() => {
        if (!isActive || !hoverPosition || pendingPosition || hasPendingTeamAssignment) return;

        const handleClick = () => {
            setPendingPosition(hoverPosition.clone());
        };

        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, [isActive, hoverPosition, pendingPosition, hasPendingTeamAssignment]);

    const handleConfirm = async () => {
        // Clear any previous errors
        setErrorMessage(null);

        try {
            // If we have a pending team assignment, confirm that
            if (hasPendingTeamAssignment && data && typeof data.pendingTeamId === "string") {
                await confirmTeamAssignment(data.pendingTeamId);
                return;
            }

            // Otherwise, confirm coordinate placement
            if (!pendingPosition) return;
            await confirmCoordinatePlacement(pendingPosition);
            setPendingPosition(null);
        } catch (error: unknown) {
            // Show error message to user
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

    // Resolve messages dynamically from the prefab definition
    const confirmMsg: string = typeof prefab.placement.confirmMessage === 'function'
        ? (prefab.placement.confirmMessage(data) as string)
        : (prefab.placement.confirmMessage as string);

    return (
        <group>
            {/* Ghost Object (only show for coordinate placement, not team assignment) */}
            {!hasPendingTeamAssignment && (hoverPosition || pendingPosition) && GhostComponent && (
                <group position={pendingPosition || hoverPosition || undefined}>
                    <GhostComponent />
                </group>
            )}

            {/* Confirmation Panel for Coordinate Placement */}
            {!hasPendingTeamAssignment && pendingPosition && (
                <Html position={[pendingPosition.x, pendingPosition.y + 2, pendingPosition.z]} center>
                    <div className="pointer-events-auto w-64">
                        <Card>
                            <CardHeader>
                                <CardTitle>Confirm Placement</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p>{confirmMsg}</p>
                                <p className="text-xs text-muted-foreground">
                                    {pendingPosition.x.toFixed(1)}, {pendingPosition.z.toFixed(1)}
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

            {/* Confirmation Panel for Team Assignment (Hybrid Placement) */}
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
