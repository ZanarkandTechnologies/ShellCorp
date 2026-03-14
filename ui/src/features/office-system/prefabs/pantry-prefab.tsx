/**
 * PANTRY PREFAB
 * Built-in furniture: coordinate placement, persisted as meshType "pantry".
 */
import { Box } from "@react-three/drei";
import type { GameObjectDefinition } from "../definitions";

function PantryGhost() {
  return (
    <group>
      <Box args={[6, 1, 1]} position={[0, 0.5, -0.5]}>
        <meshStandardMaterial color="#FFFFFF" transparent opacity={0.5} />
      </Box>
      <Box args={[0.8, 1.8, 0.75]} position={[3.4, 0.9, -0.5]}>
        <meshStandardMaterial color="#E0E0E0" transparent opacity={0.5} />
      </Box>
    </group>
  );
}

export const PantryPrefab: GameObjectDefinition = {
  id: "pantry",
  displayName: "Pantry",
  Ghost: PantryGhost,
  placement: {
    type: "coordinate",
    confirmMessage: (data) =>
      data && typeof data.displayName === "string" && data.displayName.trim()
        ? `Place ${data.displayName} here?`
        : "Place pantry here?",
    behaviorId: "place_generic",
  },
};
