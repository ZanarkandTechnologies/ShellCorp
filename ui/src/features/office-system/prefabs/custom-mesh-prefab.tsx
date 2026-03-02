import { Box } from "@react-three/drei";
import type { GameObjectDefinition } from "../definitions";

function CustomMeshGhost() {
  return (
    <Box args={[1.4, 1.4, 1.4]} position={[0, 0.7, 0]}>
      <meshStandardMaterial color="#a78bfa" transparent opacity={0.45} />
    </Box>
  );
}

export const CustomMeshPrefab: GameObjectDefinition = {
  id: "custom-mesh",
  displayName: "Custom Mesh",
  Ghost: CustomMeshGhost,
  placement: {
    type: "coordinate",
    confirmMessage: (data) => {
      if (data && typeof data.itemName === "string" && data.itemName.trim()) {
        return `Place ${data.itemName} here?`;
      }
      return "Place custom mesh here?";
    },
    hint: "Mesh loads from ~/.openclaw/assets/meshes through the OpenClaw bridge.",
    behaviorId: "place_generic",
  },
};
