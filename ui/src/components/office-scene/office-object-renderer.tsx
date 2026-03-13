/**
 * OFFICE OBJECT RENDERER
 * ======================
 * Renders persisted office objects and registers their obstacle refs for navigation bootstrap.
 *
 * KEY CONCEPTS:
 * - Keep mesh-type switching isolated from scene bootstrap and employee rendering.
 * - Object registration stays explicit so nav-grid startup can count mounted obstacles deterministically.
 *
 * USAGE:
 * - Render from `SceneContents` with scene-derived maps and registration helpers.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 * - MEM-0171
 */

import type * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import Bookshelf from "@/features/office-system/components/bookshelf";
import Couch from "@/features/office-system/components/couch";
import CustomMeshObject from "@/features/office-system/components/custom-mesh-object";
import GlassWall from "@/features/office-system/components/glass-wall";
import Pantry from "@/features/office-system/components/pantry";
import Plant from "@/features/office-system/components/plant";
import TeamCluster from "@/features/office-system/components/team-cluster";
import WallArt from "@/features/office-system/components/wall-art";
import type { OfficeFootprint } from "@/lib/office-footprint";
import type { DeskLayoutData, OfficeId, OfficeObject, TeamData } from "@/lib/types";

export function OfficeObjectRenderer(props: {
  officeObjects: OfficeObject[];
  companyId?: OfficeId<"companies">;
  teamById: Map<string, TeamData>;
  desksByTeamId: Map<string, DeskLayoutData[]>;
  officeFootprint: OfficeFootprint;
  handleTeamClick: (team: TeamData) => Promise<void>;
  handleManagementClick: (event: ThreeEvent<MouseEvent>) => void;
  getObjectRef: (objectId: string) => React.RefObject<THREE.Group | null>;
  createRegisteredObjectRef: (
    objectId: string,
    objectRef: React.MutableRefObject<THREE.Group | null>,
  ) => (element: THREE.Group | null) => void;
}): Array<JSX.Element | null> {
  const {
    officeObjects,
    companyId,
    teamById,
    desksByTeamId,
    officeFootprint,
    handleTeamClick,
    handleManagementClick,
    getObjectRef,
    createRegisteredObjectRef,
  } = props;

  return officeObjects.map((object) => {
    const objectRef = getObjectRef(object._id);
    const setRef = createRegisteredObjectRef(
      object._id,
      objectRef as React.MutableRefObject<THREE.Group | null>,
    );

    switch (object.meshType) {
      case "plant":
        return (
          <group key={object._id} ref={setRef} name={`obstacle-plant-${object._id}`}>
            <Plant
              objectId={object._id}
              position={object.position as [number, number, number]}
              rotation={object.rotation as [number, number, number]}
              scale={object.scale as [number, number, number] | undefined}
              companyId={companyId}
              metadata={object.metadata}
            />
          </group>
        );

      case "couch":
        return (
          <group key={object._id} ref={setRef} name={`obstacle-couch-${object._id}`}>
            <Couch
              objectId={object._id}
              position={object.position as [number, number, number]}
              rotation={object.rotation as [number, number, number]}
              scale={object.scale as [number, number, number] | undefined}
              companyId={companyId}
              metadata={object.metadata}
            />
          </group>
        );

      case "bookshelf":
        return (
          <group key={object._id} ref={setRef} name={`obstacle-bookshelf-${object._id}`}>
            <Bookshelf
              objectId={object._id}
              position={object.position as [number, number, number]}
              rotation={object.rotation as [number, number, number]}
              scale={object.scale as [number, number, number] | undefined}
              companyId={companyId}
              metadata={object.metadata}
            />
          </group>
        );

      case "pantry":
        return (
          <group key={object._id} ref={setRef} name={`obstacle-pantry-${object._id}`}>
            <Pantry
              objectId={object._id}
              position={object.position as [number, number, number]}
              rotation={object.rotation as [number, number, number]}
              scale={object.scale as [number, number, number] | undefined}
              companyId={companyId}
              metadata={object.metadata}
            />
          </group>
        );

      case "team-cluster": {
        const metadataTeamId =
          typeof object.metadata?.teamId === "string" ? object.metadata.teamId : "";
        const team = teamById.get(metadataTeamId);
        const teamDesks = team ? (desksByTeamId.get(team._id) ?? []) : [];

        if (!team) return null;

        return (
          <group key={object._id} ref={setRef} name={`obstacle-cluster-${team.name}`}>
            <TeamCluster
              team={team}
              desks={teamDesks}
              handleTeamClick={handleTeamClick}
              onPrimaryAction={team._id === "team-management" ? handleManagementClick : undefined}
              companyId={companyId}
              objectId={object._id}
              position={object.position as [number, number, number]}
              rotation={object.rotation as [number, number, number]}
              metadata={object.metadata}
            />
          </group>
        );
      }

      case "glass-wall":
        return (
          <group key={object._id} ref={setRef} name={`obstacle-glass-wall-${object._id}`}>
            <GlassWall
              objectId={object._id}
              position={object.position as [number, number, number]}
              rotation={object.rotation as [number, number, number]}
              scale={object.scale as [number, number, number] | undefined}
              companyId={companyId}
              metadata={object.metadata}
            />
          </group>
        );

      case "custom-mesh":
        return (
          <group key={object._id} ref={setRef} name={`obstacle-custom-mesh-${object._id}`}>
            <CustomMeshObject
              objectId={object._id}
              position={object.position as [number, number, number]}
              rotation={object.rotation as [number, number, number]}
              scale={object.scale as [number, number, number] | undefined}
              companyId={companyId}
              meshUrl={
                typeof object.metadata?.meshPublicPath === "string"
                  ? object.metadata.meshPublicPath
                  : ""
              }
              label={
                typeof object.metadata?.displayName === "string"
                  ? object.metadata.displayName
                  : undefined
              }
              metadata={object.metadata}
            />
          </group>
        );

      case "wall-art":
        return (
          <group key={object._id} name={`wall-art-${object._id}`}>
            <WallArt
              metadata={object.metadata}
              officeFootprint={officeFootprint}
              fallbackPosition={object.position as [number, number, number]}
              fallbackRotation={object.rotation as [number, number, number]}
            />
          </group>
        );

      default:
        console.warn(`Unknown meshType: ${object.meshType}`);
        return null;
    }
  });
}
