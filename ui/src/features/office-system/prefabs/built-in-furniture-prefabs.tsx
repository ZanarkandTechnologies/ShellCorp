/**
 * Built-in furniture prefabs (couch, bookshelf, pantry, plant).
 * Coordinate-based placement; stored in officeObjects with meshType = id.
 */
import { Box } from "@react-three/drei";
import type { GameObjectDefinition } from "../definitions";

const BUILT_IN_GHOST_COLOR = "#94a3b8";
const BUILT_IN_GHOST_OPACITY = 0.5;

function CouchGhost() {
  return (
    <Box args={[2, 0.5, 1]} position={[0, 0.25, 0]}>
      <meshStandardMaterial color={BUILT_IN_GHOST_COLOR} transparent opacity={BUILT_IN_GHOST_OPACITY} />
    </Box>
  );
}

function BookshelfGhost() {
  return (
    <Box args={[1.2, 1.5, 0.4]} position={[0, 0.75, 0]}>
      <meshStandardMaterial color={BUILT_IN_GHOST_COLOR} transparent opacity={BUILT_IN_GHOST_OPACITY} />
    </Box>
  );
}

function PantryGhost() {
  return (
    <Box args={[2, 1, 0.6]} position={[0, 0.5, 0]}>
      <meshStandardMaterial color={BUILT_IN_GHOST_COLOR} transparent opacity={BUILT_IN_GHOST_OPACITY} />
    </Box>
  );
}

function PlantGhost() {
  return (
    <Box args={[0.6, 0.8, 0.6]} position={[0, 0.4, 0]}>
      <meshStandardMaterial color={BUILT_IN_GHOST_COLOR} transparent opacity={BUILT_IN_GHOST_OPACITY} />
    </Box>
  );
}

function LampGhost() {
  return (
    <Box args={[0.25, 0.55, 0.25]} position={[0, 0.28, 0]}>
      <meshStandardMaterial color={BUILT_IN_GHOST_COLOR} transparent opacity={BUILT_IN_GHOST_OPACITY} />
    </Box>
  );
}

function WaterDispenserGhost() {
  return (
    <Box args={[0.35, 1.1, 0.3]} position={[0, 0.55, 0]}>
      <meshStandardMaterial color={BUILT_IN_GHOST_COLOR} transparent opacity={BUILT_IN_GHOST_OPACITY} />
    </Box>
  );
}

function MarbleTableGhost() {
  return (
    <Box args={[1.2, 0.1, 0.65]} position={[0, 0.22, 0]}>
      <meshStandardMaterial color={BUILT_IN_GHOST_COLOR} transparent opacity={BUILT_IN_GHOST_OPACITY} />
    </Box>
  );
}

function DiningTableGhost() {
  return (
    <Box args={[2.2, 0.08, 1]} position={[0, 0.4, 0]}>
      <meshStandardMaterial color={BUILT_IN_GHOST_COLOR} transparent opacity={BUILT_IN_GHOST_OPACITY} />
    </Box>
  );
}

function ModernDeskGhost() {
  return (
    <Box args={[1.4, 0.85, 0.75]} position={[0, 0.45, 0]}>
      <meshStandardMaterial color={BUILT_IN_GHOST_COLOR} transparent opacity={BUILT_IN_GHOST_OPACITY} />
    </Box>
  );
}

export const CouchPrefab: GameObjectDefinition = {
  id: "couch",
  displayName: "Lounge Couch",
  Ghost: CouchGhost,
  placement: {
    type: "coordinate",
    confirmMessage: "Place couch here?",
    hint: "Click on the office floor to place. Only inside the room.",
    behaviorId: "place_generic",
  },
};

export const BookshelfPrefab: GameObjectDefinition = {
  id: "bookshelf",
  displayName: "Bookshelf",
  Ghost: BookshelfGhost,
  placement: {
    type: "coordinate",
    confirmMessage: "Place bookshelf here?",
    hint: "Click on the office floor to place. Only inside the room.",
    behaviorId: "place_generic",
  },
};

export const PantryPrefab: GameObjectDefinition = {
  id: "pantry",
  displayName: "Pantry Counter",
  Ghost: PantryGhost,
  placement: {
    type: "coordinate",
    confirmMessage: "Place pantry here?",
    hint: "Click on the office floor to place. Only inside the room.",
    behaviorId: "place_generic",
  },
};

export const PlantPrefab: GameObjectDefinition = {
  id: "plant",
  displayName: "Plant",
  Ghost: PlantGhost,
  placement: {
    type: "coordinate",
    confirmMessage: "Place plant here?",
    hint: "Click on the office floor to place. Only inside the room.",
    behaviorId: "place_generic",
  },
};

export const LampPrefab: GameObjectDefinition = {
  id: "lamp",
  displayName: "Desk Lamp",
  Ghost: LampGhost,
  placement: {
    type: "coordinate",
    confirmMessage: "Place lamp here?",
    hint: "Click on the office floor to place. Only inside the room.",
    behaviorId: "place_generic",
  },
};

export const WaterDispenserPrefab: GameObjectDefinition = {
  id: "water-dispenser",
  displayName: "Water Dispenser",
  Ghost: WaterDispenserGhost,
  placement: {
    type: "coordinate",
    confirmMessage: "Place water dispenser here?",
    hint: "Click on the office floor to place. Only inside the room.",
    behaviorId: "place_generic",
  },
};

export const MarbleTablePrefab: GameObjectDefinition = {
  id: "marble-table",
  displayName: "Marble Coffee Table",
  Ghost: MarbleTableGhost,
  placement: {
    type: "coordinate",
    confirmMessage: "Place marble table here?",
    hint: "Click on the office floor to place. Only inside the room.",
    behaviorId: "place_generic",
  },
};

export const DiningTablePrefab: GameObjectDefinition = {
  id: "dining-table",
  displayName: "Dining Table",
  Ghost: DiningTableGhost,
  placement: {
    type: "coordinate",
    confirmMessage: "Place dining table here?",
    hint: "Click on the office floor to place. Only inside the room.",
    behaviorId: "place_generic",
  },
};

export const ModernDeskPrefab: GameObjectDefinition = {
  id: "modern-desk",
  displayName: "Modern Desk",
  Ghost: ModernDeskGhost,
  placement: {
    type: "coordinate",
    confirmMessage: "Place modern desk here?",
    hint: "Click on the office floor to place. Only inside the room.",
    behaviorId: "place_generic",
  },
};
