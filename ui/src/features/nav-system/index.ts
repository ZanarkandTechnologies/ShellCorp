/**
 * NAVIGATION SYSTEM (Public API)
 * ==============================
 * 
 * This is the public API for the Navigation System feature module.
 * Import from here when using navigation components, pathfinding utilities,
 * or types from outside this feature module.
 * 
 * USAGE:
 * ------
 * import { NavMesh, PathVisualizer, findPathAStar } from '@/features/nav-system';
 */

// Pathfinding Algorithms & Utilities
export {
    initializeGrid,
    getGridData,
    findPathAStar,
    worldToGrid,
    gridToWorld,
} from './pathfinding/a-star-pathfinding';

export {
    findAvailableDestination,
    releaseEmployeeReservations,
    getActiveDestinations,
} from './pathfinding/destination-registry';

export {
    initializePathfinding,
    buildNavMesh,
    findPath,
} from './pathfinding/pathfinding';

// Components
export { NavMesh } from './components/nav-mesh';
export { default as PathVisualizer } from './components/path-visualizer';
export { default as StatusIndicator, type StatusType } from './components/status-indicator';

