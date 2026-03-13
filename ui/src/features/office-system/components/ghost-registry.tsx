import { DeskGhost } from "./desk";
import { TeamClusterGhost } from "./team-cluster";
import {
  CouchPrefab,
  BookshelfPrefab,
  PantryPrefab,
  PlantPrefab,
  LampPrefab,
  WaterDispenserPrefab,
  MarbleTablePrefab,
  DiningTablePrefab,
  ModernDeskPrefab,
} from "../prefabs/built-in-furniture-prefabs.tsx";

// Registry mapping item types to their Ghost components
export const GHOST_REGISTRY: Record<string, React.ComponentType> = {
  "desk": DeskGhost,
  "team-cluster": TeamClusterGhost,
  "couch": CouchPrefab.Ghost,
  "bookshelf": BookshelfPrefab.Ghost,
  "pantry": PantryPrefab.Ghost,
  "plant": PlantPrefab.Ghost,
  "lamp": LampPrefab.Ghost,
  "water-dispenser": WaterDispenserPrefab.Ghost,
  "marble-table": MarbleTablePrefab.Ghost,
  "dining-table": DiningTablePrefab.Ghost,
  "modern-desk": ModernDeskPrefab.Ghost,
};

export function getGhostComponent(type: string | null) {
    if (!type) return null;
    return GHOST_REGISTRY[type] || null;
}

