/**
 * DESK PREFAB (Data Definition)
 * =============================
 * 
 * This file defines the "blueprint" for a Desk object in the office system.
 * It declares how desks are placed, what they look like in placement mode,
 * and what behavior they trigger when placed.
 * 
 * PREFAB PATTERN:
 * ---------------
 * A "Prefab" is a game development term for a reusable object template.
 * This prefab declares:
 * - **ID**: Unique identifier ("desk")
 * - **Display Name**: User-facing name ("Office Desk")
 * - **Ghost**: Visual preview during placement (DeskGhost component)
 * - **Placement Behavior**: "increment_desk" - adds to team's desk count
 * 
 * PLACEMENT TYPE:
 * ---------------
 * - **"hybrid"**: Can be placed in two ways:
 *   1. Click on a team cluster → Adds desk to that team (procedural)
 *   2. Click on empty floor → (Future) Places standalone desk at coordinates
 * 
 * BEHAVIOR ID:
 * ------------
 * - **"increment_desk"**: When confirmed, calls the `incrementDeskCount` mutation
 *   on the target team, triggering procedural desk rendering.
 * 
 * REGISTRY:
 * ---------
 * This prefab is registered in `components/object-registry.ts` under the key "desk".
 */
import { GameObjectDefinition } from "../definitions";
import { DeskGhost } from "../components/desk";

export const DeskPrefab: GameObjectDefinition = {
    id: "desk",
    displayName: "Office Desk",
    Ghost: DeskGhost,
    placement: {
        type: "hybrid",
        confirmMessage: "Place Desk here?",
        hint: "Tip: Click on a team circle to assign desk to that team",
        behaviorId: "increment_desk"
    }
};

