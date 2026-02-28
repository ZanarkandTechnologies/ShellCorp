/**
 * OBJECT REGISTRY (Database)
 * ==========================
 * 
 * This acts as the central "Prefab Database" for the game.
 * It maps a string ID (e.g. "desk") to a fully defined GameObject Definition.
 * 
 * USAGE:
 * ------
 * When creating a new object type:
 * 1. Create the component file (e.g. `printer.tsx`)
 * 2. Define and export its `GameObjectDefinition`
 * 3. Import it here and add it to `OBJECT_REGISTRY`
 * 
 * This allows the `PlacementHandler` to work generically with ANY object type.
 */
import { GameObjectDefinition } from "../definitions";
import { DeskPrefab } from "../prefabs/desk-prefab";
import { TeamClusterPrefab } from "../prefabs/team-cluster-prefab";
import { CustomMeshPrefab } from "../prefabs/custom-mesh-prefab";

// Registry mapping item types to their full Prefab Definitions
export const OBJECT_REGISTRY: Record<string, GameObjectDefinition> = {
    "desk": DeskPrefab,
    "team-cluster": TeamClusterPrefab,
    "custom-mesh": CustomMeshPrefab,
    // Add new items here:
    // "plant": PlantPrefab,
};

export function getGameObjectDefinition(type: string | null): GameObjectDefinition | null {
    if (!type) return null;
    return OBJECT_REGISTRY[type] || null;
}

