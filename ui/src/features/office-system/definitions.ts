/**
 * GAME OBJECT DEFINITION CONTRACT
 * =================================
 * 
 * This interface is the core contract for the "Prefab" system.
 * In Game Development terms, this is like a ScriptableObject or Prefab definition.
 * 
 * PURPOSE:
 * --------
 * Defines everything the engine needs to know about an object WITHOUT needing to instantiate it.
 * This decouples the "Placement System" from specific object implementations.
 * 
 * USAGE:
 * ------
 * 1. Create a React component for your object (e.g. Desk.tsx)
 * 2. Define a const of type GameObjectDefinition in that file
 * 3. Export it and register it in object-registry.ts
 * 
 * @example
 * export const DeskPrefab: GameObjectDefinition = {
 *   id: "desk",
 *   Ghost: DeskGhost,
 *   placement: { type: 'hybrid', confirmMessage: "Place?" }
 * }
 */
import * as React from "react";

export interface GameObjectDefinition {
    id: string;             // Unique ID (e.g., 'desk', 'team-cluster')
    displayName: string;    // User-facing name

    // VISUALS
    Ghost: React.ComponentType; // The visual to show during placement

    // PLACEMENT BEHAVIOR
    placement: {
        type: 'coordinate' | 'hybrid' | 'team'; // How is it placed?

        // UI Messages
        confirmMessage: string | ((data: any) => string);
        hint?: string;

        // LOGIC: Which mutation strategy to use?
        // Examples: 'create_team', 'increment_desk', 'place_object'
        behaviorId?: string;
    };
}

