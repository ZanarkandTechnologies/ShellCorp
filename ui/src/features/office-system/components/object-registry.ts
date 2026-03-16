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
import { BookshelfPrefab } from "../prefabs/bookshelf-prefab";
import { CouchPrefab } from "../prefabs/couch-prefab";
import { CustomMeshPrefab } from "../prefabs/custom-mesh-prefab";
import { DeskPrefab } from "../prefabs/desk-prefab";
import { PantryPrefab } from "../prefabs/pantry-prefab";
import { PlantPrefab } from "../prefabs/plant-prefab";
import { TeamClusterPrefab } from "../prefabs/team-cluster-prefab";

// Registry mapping item types to their full Prefab Definitions
export const OBJECT_REGISTRY: Record<string, GameObjectDefinition> = {
    "desk": DeskPrefab,
    "team-cluster": TeamClusterPrefab,
    "custom-mesh": CustomMeshPrefab,
    "plant": PlantPrefab,
    "couch": CouchPrefab,
    "bookshelf": BookshelfPrefab,
    "pantry": PantryPrefab,
};

export function getGameObjectDefinition(type: string | null): GameObjectDefinition | null {
    if (!type) return null;
    return OBJECT_REGISTRY[type] || null;
}

