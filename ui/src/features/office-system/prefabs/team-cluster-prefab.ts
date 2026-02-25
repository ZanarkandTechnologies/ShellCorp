/**
 * TEAM CLUSTER PREFAB (Data Definition)
 * =====================================
 * 
 * This file defines the "blueprint" for a Team Cluster object in the office system.
 * A Team Cluster represents a team's base location in the 3D office, marked by
 * a flag/banner and surrounded by procedurally-placed desks.
 * 
 * PREFAB PATTERN:
 * ---------------
 * This prefab declares:
 * - **ID**: Unique identifier ("team-cluster")
 * - **Display Name**: User-facing name ("Team Base")
 * - **Ghost**: Visual preview during placement (TeamClusterGhost - pole + banner)
 * - **Placement Behavior**: "create_team" - creates a new team and office object
 * 
 * PLACEMENT TYPE:
 * ---------------
 * - **"coordinate"**: Must be placed at a specific XYZ coordinate in the 3D scene.
 *   The user clicks on the floor to choose where the team's base will be located.
 * 
 * BEHAVIOR ID:
 * ------------
 * - **"create_team"**: When confirmed, calls the `createTeamAndPlace` mutation,
 *   which creates both:
 *   1. A `teams` table entry with the team's metadata
 *   2. An `officeObjects` table entry for the visual marker
 * 
 * DATABASE STORAGE:
 * -----------------
 * Unlike desks (which are procedural), team clusters ARE stored in the database:
 * - `teams` table: Team metadata + `clusterPosition`
 * - `officeObjects` table: Visual marker object with mesh type "team-cluster"
 * 
 * REGISTRY:
 * ---------
 * This prefab is registered in `components/object-registry.ts` under the key "team-cluster".
 */
import { GameObjectDefinition } from "../definitions";
import { TeamClusterGhost } from "../components/team-cluster";

export const TeamClusterPrefab: GameObjectDefinition = {
    id: "team-cluster",
    displayName: "Team Base",
    Ghost: TeamClusterGhost,
    placement: {
        type: "coordinate",
        confirmMessage: "Place Team Base here?",
        behaviorId: "create_team"
    }
};

