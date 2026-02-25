/**
 * PLACEMENT SYSTEM (Game System)
 * ==============================
 * 
 * This hook acts as a centralized Game Manager for the "Placement State".
 * It implements the "Systems" part of an ECS (Entity-Component-System) architecture.
 * 
 * RESPONSIBILITIES:
 * -----------------
 * 1. State Management: Handles active/inactive state of placement mode.
 * 2. Logic Control: Determines what happens when a user confirms/cancels.
 * 3. Database Sync: Executes the actual mutations (createTeam, incrementDesk).
 * 4. Validation: (Future) Checks if placement is valid (collision, cost, etc).
 * 
 * USAGE:
 * ------
 * // In any UI component (Shop, HUD):
 * const { startPlacement } = usePlacementSystem();
 * startPlacement('desk', { companyId: '...' });
 * 
 * // In the Scene (PlacementHandler):
 * const { confirmCoordinatePlacement } = usePlacementSystem();
 * */
import { useAppStore } from "@/lib/app-store";
import { useThree } from "@react-three/fiber";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import * as THREE from "three";
import { useState, useCallback } from "react";
import { Id } from "@/convex/_generated/dataModel";

import { getGameObjectDefinition } from "../components/object-registry";

// Use string to support infinite item types (e.g. "desk", "plant-01", "team-cluster")
export type PlacementType = string | null;

export function usePlacementSystem() {
    const placementMode = useAppStore(state => state.placementMode);
    const setPlacementMode = useAppStore(state => state.setPlacementMode);
    const { active, type, data } = placementMode;

    // Mutations
    const createTeamAndPlace = useMutation(api.office_system.teams.createTeamAndPlace);
    const incrementDeskCount = useMutation(api.office_system.teams.incrementDeskCount);

    // Actions
    const startPlacement = useCallback((type: PlacementType, data: Record<string, unknown>) => {
        setPlacementMode({ active: true, type, data });
    }, [setPlacementMode]);

    const cancelPlacement = useCallback(() => {
        setPlacementMode({ active: false, type: null, data: null });
    }, [setPlacementMode]);

    // Logic: Place a generic coordinate-based item
    const confirmCoordinatePlacement = useCallback(async (position: THREE.Vector3) => {
        if (!active || !type) return;

        // Lookup the prefab definition to find the behavior
        const prefab = getGameObjectDefinition(type);
        const behaviorId = prefab?.placement?.behaviorId;

        try {
            const posArray: [number, number, number] = [position.x, position.y, position.z];

            // STRATEGY PATTERN:
            // Dispatch based on the behavior declared in the object definition.
            switch (behaviorId) {
                case "create_team":
                    if (data && typeof data.name === "string" && typeof data.description === "string" && typeof data.companyId === "string") {
                        await createTeamAndPlace({
                            name: data.name,
                            description: data.description,
                            companyId: data.companyId as Id<"companies">,
                            position: posArray,
                            services: Array.isArray(data.services) ? data.services : undefined,
                        });
                    }
                    break;

                case "place_generic":
                    // Future: await placeGenericObject(...)
                    console.log("Placing generic object at", posArray);
                    break;

                default:
                    console.warn(`No placement strategy found for behavior: ${behaviorId} (Item: ${type})`);
                    break;
            }

            // Reset after successful placement
            cancelPlacement();
        } catch (error) {
            console.error("Placement failed:", error);
        }
    }, [active, type, data, createTeamAndPlace, cancelPlacement]);

    // Logic: Place a desk onto a specific team (Hybrid placement)
    const confirmTeamAssignment = useCallback(async (teamId: string) => {
        if (!type) return;

        const prefab = getGameObjectDefinition(type);
        const behaviorId = prefab?.placement?.behaviorId;

        if (behaviorId !== "increment_desk") {
            console.warn(`Item ${type} does not support team assignment (behavior: ${behaviorId})`);
            return;
        }

        try {
            await incrementDeskCount({ teamId: teamId as Id<"teams"> });
            cancelPlacement();
        } catch (error) {
            console.error("Failed to assign desk to team:", error);
            // Re-throw the error so the UI can handle it
            throw error;
        }
    }, [type, incrementDeskCount, cancelPlacement]);

    return {
        isActive: active,
        currentType: type,
        data,
        startPlacement,
        cancelPlacement,
        confirmCoordinatePlacement,
        confirmTeamAssignment
    };
}
