import * as THREE from 'three';
// PathfindingHelper is used as a value, remove 'type'
import { Pathfinding, PathfindingHelper, type Zone } from 'three-pathfinding';

// Initialize directly
const pathfinding = new Pathfinding();
const pathfindingHelper = new PathfindingHelper(); // Now correctly instantiated
// Use 'object' instead of 'any'
let zoneNodes: Zone | null = null; // To store NavMesh data

const ZONE_NAME = 'officeFloor';

/**
 * Initializes the Pathfinding instance and helper.
 */
export function initializePathfinding(): { pathfinding: Pathfinding, helper: PathfindingHelper } {
    console.log("Pathfinding instances retrieved.");
    return { pathfinding, helper: pathfindingHelper };
}

/**
 * Builds the navigation mesh from the floor geometry.
 * Assumes floorMesh.geometry is a valid BufferGeometry.
 * @param floorMesh The THREE.Mesh representing the walkable floor.
 * @param obstacleMeshes An array of THREE.Mesh representing obstacles (currently unused).
 */
export function buildNavMesh(floorMesh: THREE.Mesh, obstacleMeshes: THREE.Mesh[]): void {
    console.log("Building NavMesh...");
    try {
        const geometry = floorMesh.geometry;
        if (!geometry) {
            console.error("Floor mesh has no geometry.");
            return;
        }
        // Ensure it's BufferGeometry with position attribute
        if (!(geometry instanceof THREE.BufferGeometry) || !geometry.attributes.position) {
            console.error("Floor geometry is not a valid BufferGeometry with positions. Cannot build NavMesh.");
            return; // Stop if geometry is invalid
        }

        // Create zone directly assuming BufferGeometry
        zoneNodes = Pathfinding.createZone(geometry);
        pathfinding.setZoneData(ZONE_NAME, zoneNodes);
        console.log("NavMesh built for floor.");

    } catch (error) {
        console.error("Error creating pathfinding zone:", error);
        return; // Stop if zone creation fails
    }

    // TODO: Incorporate obstacles

    pathfindingHelper.reset();
    pathfindingHelper.setPlayerPosition(new THREE.Vector3());
    pathfindingHelper.setTargetPosition(new THREE.Vector3());
    console.log("NavMesh build process complete (basic floor only).");
}

/**
 * Calculates a path from startPosition to targetPosition.
 * @param startPosition The starting Vector3.
 * @param targetPosition The target Vector3.
 * @returns An array of Vector3 points representing the path, or null if no path found.
 */
export function findPath(startPosition: THREE.Vector3, targetPosition: THREE.Vector3): THREE.Vector3[] | null {
    if (!pathfinding || !zoneNodes) {
        console.error("Pathfinding not initialized or NavMesh not built.");
        return null;
    }

    let currentStartPosition = startPosition.clone();
    let currentTargetPosition = targetPosition.clone();

    const groupID = pathfinding.getGroup(ZONE_NAME, currentStartPosition);
    if (groupID === null) {
        console.warn("Start position outside NavMesh group.");
        const closestNode = pathfinding.getClosestNode(currentStartPosition, ZONE_NAME, groupID);
        if (closestNode) {
            currentStartPosition = closestNode.centroid.clone();
            console.log("Clamped start position to:", currentStartPosition);
        } else {
            console.error("Could not find closest node for start position.");
            return null;
        }
    }

    const targetGroupID = pathfinding.getGroup(ZONE_NAME, currentTargetPosition);
    if (targetGroupID === null) {
        console.warn("Target position outside NavMesh group.");
        const closestNode = pathfinding.getClosestNode(currentTargetPosition, ZONE_NAME, targetGroupID);
        if (closestNode) {
            currentTargetPosition = closestNode.centroid.clone();
            console.log("Clamped target position to:", currentTargetPosition);
        } else {
            console.error("Could not find closest node for target position.");
            return null;
        }
    }

    const path = pathfinding.findPath(currentStartPosition, currentTargetPosition, ZONE_NAME, groupID);

    if (path && pathfindingHelper) {
        pathfindingHelper.reset();
        pathfindingHelper.setPlayerPosition(currentStartPosition);
        pathfindingHelper.setTargetPosition(currentTargetPosition);
        pathfindingHelper.setPath(path);
    }

    return path;
}

/**
 * Adds the Pathfinding helper visualization to a scene.
 * @param scene The THREE.Scene to add the helper to.
 */
export function addPathfindingHelperToScene(scene: THREE.Scene): void {
    if (pathfindingHelper) {
        scene.add(pathfindingHelper);
        console.log("Pathfinding helper added to scene.");
    } else {
        console.warn("Pathfinding helper not initialized.");
    }
}
