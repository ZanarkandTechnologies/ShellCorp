/**
 * PLANT PREFAB
 * Built-in furniture: coordinate placement, persisted as meshType "plant".
 */
import { Cylinder, Sphere } from "@react-three/drei";
import type { GameObjectDefinition } from "../definitions";

function PlantGhost() {
  return (
    <group>
      <Cylinder args={[0.3, 0.35, 0.5, 16]} position={[0, 0.25, 0]}>
        <meshStandardMaterial color="#8B4513" transparent opacity={0.5} />
      </Cylinder>
      <Sphere args={[0.5, 16, 16]} position={[0, 0.8, 0]}>
        <meshStandardMaterial color="#228B22" transparent opacity={0.5} />
      </Sphere>
    </group>
  );
}

export const PlantPrefab: GameObjectDefinition = {
  id: "plant",
  displayName: "Plant",
  Ghost: PlantGhost,
  placement: {
    type: "coordinate",
    confirmMessage: (data) =>
      data && typeof data.displayName === "string" && data.displayName.trim()
        ? `Place ${data.displayName} here?`
        : "Place plant here?",
    behaviorId: "place_generic",
  },
};
