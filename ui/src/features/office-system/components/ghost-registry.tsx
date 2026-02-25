import { DeskGhost } from "./desk";
import { TeamClusterGhost } from "./team-cluster";

// Registry mapping item types to their Ghost components
export const GHOST_REGISTRY: Record<string, React.ComponentType> = {
    "desk": DeskGhost,
    "team-cluster": TeamClusterGhost,
    // Add new items here:
    // "plant": PlantGhost,
    // "printer": PrinterGhost,
};

export function getGhostComponent(type: string | null) {
    if (!type) return null;
    return GHOST_REGISTRY[type] || null;
}

