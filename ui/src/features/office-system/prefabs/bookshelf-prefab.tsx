/**
 * BOOKSHELF PREFAB
 * Built-in furniture: coordinate placement, persisted as meshType "bookshelf".
 */
import { Box } from "@react-three/drei";
import type { GameObjectDefinition } from "../definitions";

const W = 2.5;
const H = 1.8;
const D = 0.4;
const T = 0.05;

function BookshelfGhost() {
  return (
    <group>
      <Box args={[T, H, D]} position={[-W / 2 + T / 2, H / 2, 0]}>
        <meshStandardMaterial color="#8B4513" transparent opacity={0.5} />
      </Box>
      <Box args={[T, H, D]} position={[W / 2 - T / 2, H / 2, 0]}>
        <meshStandardMaterial color="#8B4513" transparent opacity={0.5} />
      </Box>
      <Box args={[W - T * 2, H, T]} position={[0, H / 2, -D / 2 + T / 2]}>
        <meshStandardMaterial color="#8B4513" transparent opacity={0.4} />
      </Box>
      {[0, 1, 2, 3, 4].map((i) => (
        <Box
          key={i}
          args={[W - T * 2, T, D - T]}
          position={[0, T / 2 + (i * (H - T)) / 4, 0]}
        >
          <meshStandardMaterial color="#8B4513" transparent opacity={0.5} />
        </Box>
      ))}
    </group>
  );
}

export const BookshelfPrefab: GameObjectDefinition = {
  id: "bookshelf",
  displayName: "Bookshelf",
  Ghost: BookshelfGhost,
  placement: {
    type: "coordinate",
    confirmMessage: (data) =>
      data && typeof data.displayName === "string" && data.displayName.trim()
        ? `Place ${data.displayName} here?`
        : "Place bookshelf here?",
    behaviorId: "place_generic",
  },
};
