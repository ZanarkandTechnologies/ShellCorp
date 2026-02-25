/**
 * OFFICE SYSTEM (Public API)
 * ===========================
 * 
 * This is the public API for the Office System feature module.
 * Import from here when using office system components, hooks, or utilities
 * from outside this feature module.
 * 
 * USAGE:
 * ------
 * import { usePlacementSystem, Desk, TeamCluster } from '@/features/office-system';
 */

// Systems & Hooks
export { usePlacementSystem } from './systems/placement-system';

// Components
export { default as Desk } from './components/desk';
export { default as TeamCluster } from './components/team-cluster';
export { default as Plant } from './components/plant';
export { default as Couch } from './components/couch';
export { default as Bookshelf } from './components/bookshelf';
export { default as Pantry } from './components/pantry';
export { default as GlassWall } from './components/glass-wall';
export { Employee } from './components/employee';
export { InteractiveObject } from './components/interactive-object';
export { ContextMenu } from './components/context-menu';
export type { MenuAction } from './components/context-menu';
export { GenericMeshObject } from './components/generic-mesh-object';

// Registries & Utilities
export { getGameObjectDefinition } from './components/object-registry';
export { getGhostComponent } from './components/ghost-registry';

// Types
export type { GameObjectDefinition } from './definitions';

// Stores
export { useObjectRegistrationStore } from './store';

