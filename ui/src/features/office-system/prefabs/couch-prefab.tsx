/**
 * COUCH PREFAB
 * Built-in furniture: coordinate placement, persisted as meshType "couch".
 */
import { Box } from "@react-three/drei";
import type { GameObjectDefinition } from "../definitions";

function CouchGhost() {
  const color = "#4682B4";
  return (
    <group>
      <Box args={[2.5, 0.4, 1]} position={[0, 0.2, 0]}>
        <meshStandardMaterial color={color} transparent opacity={0.5} />
      </Box>
      <Box args={[2.5, 0.6, 0.2]} position={[0, 0.7, -0.4]}>
        <meshStandardMaterial color={color} transparent opacity={0.5} />
      </Box>
      <Box args={[0.2, 0.3, 1]} position={[-1.15, 0.55, 0]}>
        <meshStandardMaterial color={color} transparent opacity={0.5} />
      </Box>
      <Box args={[0.2, 0.3, 1]} position={[1.15, 0.55, 0]}>
        <meshStandardMaterial color={color} transparent opacity={0.5} />
      </Box>
    </group>
  );
}

export const CouchPrefab: GameObjectDefinition = {
  id: "couch",
  displayName: "Couch",
  Ghost: CouchGhost,
  placement: {
    type: "coordinate",
    confirmMessage: (data) =>
      data && typeof data.displayName === "string" && data.displayName.trim()
        ? `Place ${data.displayName} here?`
        : "Place couch here?",
    behaviorId: "place_generic",
  },
};
