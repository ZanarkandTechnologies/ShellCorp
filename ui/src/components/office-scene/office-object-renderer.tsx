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
 */

import type * as THREE from 'three';
import type { DeskLayoutData, OfficeId, OfficeObject, TeamData } from '@/lib/types';
import Plant from '@/features/office-system/components/plant';
import Couch from '@/features/office-system/components/couch';
import Bookshelf from '@/features/office-system/components/bookshelf';
import Pantry from '@/features/office-system/components/pantry';
import Lamp from '@/features/office-system/components/lamp';
import WaterDispenser from '@/features/office-system/components/water-dispenser';
import MarbleTable from '@/features/office-system/components/marble-table';
import DiningTable from '@/features/office-system/components/dining-table';
import ModernDesk from '@/features/office-system/components/modern-desk';
import CustomMeshObject from '@/features/office-system/components/custom-mesh-object';
import TeamCluster from '@/features/office-system/components/team-cluster';
import GlassWall from '@/features/office-system/components/glass-wall';

export function OfficeObjectRenderer(props: {
    officeObjects: OfficeObject[];
    companyId?: OfficeId<'companies'>;
    teamById: Map<string, TeamData>;
    desksByTeamId: Map<string, DeskLayoutData[]>;
    handleTeamClick: (team: TeamData) => Promise<void>;
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
        handleTeamClick,
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
            case 'plant':
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

            case 'couch':
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

            case 'bookshelf':
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

            case 'pantry':
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

            case 'lamp':
                return (
                    <group key={object._id} ref={setRef} name={`obstacle-lamp-${object._id}`}>
                        <Lamp
                            objectId={object._id}
                            position={object.position as [number, number, number]}
                            rotation={object.rotation as [number, number, number]}
                            scale={object.scale as [number, number, number] | undefined}
                            companyId={companyId}
                            metadata={object.metadata}
                        />
                    </group>
                );

            case 'water-dispenser':
                return (
                    <group key={object._id} ref={setRef} name={`obstacle-water-dispenser-${object._id}`}>
                        <WaterDispenser
                            objectId={object._id}
                            position={object.position as [number, number, number]}
                            rotation={object.rotation as [number, number, number]}
                            scale={object.scale as [number, number, number] | undefined}
                            companyId={companyId}
                            metadata={object.metadata}
                        />
                    </group>
                );

            case 'marble-table':
                return (
                    <group key={object._id} ref={setRef} name={`obstacle-marble-table-${object._id}`}>
                        <MarbleTable
                            objectId={object._id}
                            position={object.position as [number, number, number]}
                            rotation={object.rotation as [number, number, number]}
                            scale={object.scale as [number, number, number] | undefined}
                            companyId={companyId}
                            metadata={object.metadata}
                        />
                    </group>
                );

            case 'dining-table':
                return (
                    <group key={object._id} ref={setRef} name={`obstacle-dining-table-${object._id}`}>
                        <DiningTable
                            objectId={object._id}
                            position={object.position as [number, number, number]}
                            rotation={object.rotation as [number, number, number]}
                            scale={object.scale as [number, number, number] | undefined}
                            companyId={companyId}
                            metadata={object.metadata}
                        />
                    </group>
                );

            case 'modern-desk':
                return (
                    <group key={object._id} ref={setRef} name={`obstacle-modern-desk-${object._id}`}>
                        <ModernDesk
                            objectId={object._id}
                            position={object.position as [number, number, number]}
                            rotation={object.rotation as [number, number, number]}
                            scale={object.scale as [number, number, number] | undefined}
                            companyId={companyId}
                            metadata={object.metadata}
                        />
                    </group>
                );

            case 'team-cluster': {
                const metadataTeamId = typeof object.metadata?.teamId === 'string' ? object.metadata.teamId : '';
                const team = teamById.get(metadataTeamId);
                const teamDesks = team ? desksByTeamId.get(team._id) ?? [] : [];

                if (!team) return null;

                return (
                    <group key={object._id} ref={setRef} name={`obstacle-cluster-${team.name}`}>
                        <TeamCluster
                            team={team}
                            desks={teamDesks}
                            handleTeamClick={handleTeamClick}
                            companyId={companyId}
                            objectId={object._id}
                            position={object.position as [number, number, number]}
                            rotation={object.rotation as [number, number, number]}
                            metadata={object.metadata}
                        />
                    </group>
                );
            }

            case 'glass-wall':
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

            case 'custom-mesh':
                return (
                    <group key={object._id} ref={setRef} name={`obstacle-custom-mesh-${object._id}`}>
                        <CustomMeshObject
                            objectId={object._id}
                            position={object.position as [number, number, number]}
                            rotation={object.rotation as [number, number, number]}
                            scale={object.scale as [number, number, number] | undefined}
                            companyId={companyId}
                            meshUrl={typeof object.metadata?.meshPublicPath === 'string' ? object.metadata.meshPublicPath : ''}
                            label={typeof object.metadata?.displayName === 'string' ? object.metadata.displayName : undefined}
                            metadata={object.metadata}
                        />
                    </group>
                );

            default:
                console.warn(`Unknown meshType: ${object.meshType}`);
                return null;
        }
    });
}
