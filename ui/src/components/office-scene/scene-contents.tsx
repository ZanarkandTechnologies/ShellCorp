/**
 * OFFICE SCENE CONTENTS
 * =====================
 * Internal scene composition for lighting, room shell, employees, office objects, and nav bootstrap.
 *
 * KEY CONCEPTS:
 * - This component composes focused hooks/modules instead of owning all scene responsibilities inline.
 * - Future startup phases should plug into bootstrap/hooks, not grow this component arbitrarily.
 *
 * USAGE:
 * - Render from the public `office-scene.tsx` canvas shell.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 * - MEM-0150
 */

'use client';

import { OrbitControls } from '@react-three/drei';
import { useMemo } from 'react';
import { useAppStore } from '@/lib/app-store';
import { Employee } from '@/features/office-system/components/employee';
import Desk from '@/features/office-system/components/desk';
import { ContextMenu } from '@/features/office-system/components/context-menu';
import { Trash2 } from 'lucide-react';
import { SmartGrid } from '@/components/debug/unified-grid-helper';
import { DestinationDebugger } from '@/components/debug/destination-debugger';
import { PlacementHandler } from '@/components/placement-handler';
import type { StatusType } from '@/features/nav-system/components/status-indicator';
import { HALF_FLOOR } from '@/constants';
import type { OfficeObject } from '@/lib/types';
import { OfficeLighting } from './office-lighting';
import { OfficeRoomShell } from './office-room-shell';
import { OfficeObjectRenderer } from './office-object-renderer';
import { CameraDistanceUpdater } from './camera-distance-updater';
import { Starfield } from './starfield';
import { useOfficeSceneTheme, useOfficeSceneCameraTransition } from './use-office-scene-camera';
import { useOfficeSceneInteractions } from './use-office-scene-interactions';
import { useOfficeSceneBootstrap } from './use-office-scene-bootstrap';
import { useOfficeSceneDerivedData } from './use-office-scene-derived-data';
import type { OfficeSceneProps } from './types';

function filterOfficeObjectsInBounds(objects: OfficeObject[] | undefined): OfficeObject[] {
    if (!objects?.length) return [];
    return objects.filter((obj) => {
        const pos = obj.position;
        if (!Array.isArray(pos) || pos.length < 3) return false;
        const x = pos[0];
        const z = pos[2];
        return Math.abs(x) <= HALF_FLOOR && Math.abs(z) <= HALF_FLOOR;
    });
}

export function SceneContents(props: OfficeSceneProps): JSX.Element {
    const { teams, employees, desks, officeObjects, companyId, onNavigationReady } = props;
    const enableOfficeObjects = import.meta.env.VITE_ENABLE_OFFICE_OBJECTS !== 'false';

    const isBuilderMode = useAppStore((state) => state.isBuilderMode);
    const officeView2_5D = useAppStore((state) => state.officeView2_5D);
    const debugMode = useAppStore((state) => state.debugMode);
    const isAnimatingCamera = useAppStore((state) => state.isAnimatingCamera);
    const setAnimatingCamera = useAppStore((state) => state.setAnimatingCamera);
    const isDragging = useAppStore((state) => state.isDragging);
    const placementMode = useAppStore((state) => state.placementMode);

    const officeTheme = useOfficeSceneTheme();
    const sceneBuilderMode = isAnimatingCamera ? false : isBuilderMode;
    const cameraDistance = useAppStore((state) => state.cameraDistance);
    const roomAppearance = useAppStore((state) => state.roomAppearance);
    const ceoDeskHidden = useAppStore((state) => state.ceoDeskHidden);
    const setCeoDeskHidden = useAppStore((state) => state.setCeoDeskHidden);
    const selectedObjectId = useAppStore((state) => state.selectedObjectId);
    const setSelectedObjectId = useAppStore((state) => state.setSelectedObjectId);

    const officeObjectsInBounds = useMemo(
        () => filterOfficeObjectsInBounds(officeObjects),
        [officeObjects],
    );

    const glassWallObjects = useMemo(
        () =>
            officeObjectsInBounds
                .filter((object) => object.meshType === 'glass-wall')
                .map((object) => ({ position: object.position as [number, number, number] })),
        [officeObjectsInBounds],
    );

    const {
        ceoDeskData,
        employeesForScene,
        teamById,
        desksByTeamId,
    } = useOfficeSceneDerivedData({
        teams,
        employees,
        desks,
        glassWallObjects,
    });

    const {
        orbitControlsRef,
        floorRef,
        ceoDeskRef,
        createRegisteredObjectRef,
        getObjectRef,
    } = useOfficeSceneBootstrap({
        officeObjectCount: officeObjectsInBounds.length,
        hasCeoDesk: Boolean(ceoDeskData),
        onNavigationReady,
    });

    const {
        handleBackgroundClick,
        handleEmployeeClick,
        handleTeamClick,
        handleCeoDeskClick,
    } = useOfficeSceneInteractions({ employees });

    useOfficeSceneCameraTransition({
        isBuilderMode,
        officeView2_5D,
        orbitControlsRef,
        setAnimatingCamera,
    });

    const officeObjectsRendered = useMemo(() => {
        if (!enableOfficeObjects) return null;
        return (
            <OfficeObjectRenderer
                officeObjects={officeObjectsInBounds}
                companyId={companyId}
                teamById={teamById}
                desksByTeamId={desksByTeamId}
                handleTeamClick={handleTeamClick}
                getObjectRef={getObjectRef}
                createRegisteredObjectRef={createRegisteredObjectRef}
            />
        );
    }, [
        companyId,
        createRegisteredObjectRef,
        desksByTeamId,
        enableOfficeObjects,
        getObjectRef,
        handleTeamClick,
        officeObjectsInBounds,
        teamById,
    ]);

    return (
        <>
            <Starfield />
            <OfficeLighting officeTheme={officeTheme} sceneBuilderMode={sceneBuilderMode} />

            <OrbitControls
                ref={orbitControlsRef}
                enabled={!isDragging}
                enableRotate={!officeView2_5D && !isDragging}
                enablePan={!officeView2_5D && !isDragging}
                enableZoom
                minDistance={officeView2_5D ? 8 : 5}
                maxDistance={officeView2_5D ? 40 : 200}
                minPolarAngle={officeView2_5D ? Math.PI / 3 : 0}
                maxPolarAngle={officeView2_5D ? Math.PI / 3 : sceneBuilderMode ? Math.PI / 3 : Math.PI}
                minAzimuthAngle={officeView2_5D ? Math.PI / 4 : undefined}
                maxAzimuthAngle={officeView2_5D ? Math.PI / 4 : undefined}
            />

            <CameraDistanceUpdater controlsRef={orbitControlsRef} />

            <OfficeRoomShell
                floorRef={floorRef}
                officeTheme={officeTheme}
                onBackgroundClick={handleBackgroundClick}
                cameraDistance={cameraDistance}
                roomAppearance={roomAppearance}
            />

            {ceoDeskData && !ceoDeskHidden && (
                <group ref={ceoDeskRef} name="obstacle-ceoDeskGroup">
                    <group
                        position={ceoDeskData.position}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (sceneBuilderMode) {
                                setSelectedObjectId(selectedObjectId === 'ceo-desk' ? null : 'ceo-desk');
                            } else {
                                handleCeoDeskClick(e);
                            }
                        }}
                    >
                        <Desk
                            key={ceoDeskData.id}
                            deskId={ceoDeskData.id}
                            position={[0, 0, 0]}
                            rotationY={ceoDeskData.rotationY}
                            isHovered={false}
                            onClick={undefined}
                        />
                        <ContextMenu
                            isOpen={sceneBuilderMode && selectedObjectId === 'ceo-desk'}
                            onClose={() => setSelectedObjectId(null)}
                            actions={[
                                {
                                    id: 'delete',
                                    label: 'Remove',
                                    icon: Trash2,
                                    onClick: () => {
                                        setCeoDeskHidden(true);
                                        setSelectedObjectId(null);
                                    },
                                },
                            ]}
                            title="CEO desk"
                        />
                    </group>
                </group>
            )}

            {!sceneBuilderMode &&
                employeesForScene.map((employee) => (
                    <Employee
                        key={employee._id}
                        _id={employee._id}
                        name={employee.name}
                        position={employee.initialPosition}
                        isBusy={employee.isBusy}
                        isCEO={employee.isCEO}
                        isSupervisor={employee.isSupervisor}
                        gender={employee.gender}
                        onClick={handleEmployeeClick}
                        debugMode={debugMode}
                        status={(employee.status || 'none') as StatusType}
                        statusMessage={employee.statusMessage}
                        wantsToWander={employee.wantsToWander}
                        jobTitle={employee.jobTitle}
                        team={employee.team}
                        teamId={employee.teamId}
                        notificationCount={employee.notificationCount}
                        notificationPriority={employee.notificationPriority}
                        heartbeatState={employee.heartbeatState}
                        heartbeatBubbles={employee.heartbeatBubbles}
                        profileImageUrl={employee.profileImageUrl}
                    />
                ))}

            {officeObjectsRendered}

            <SmartGrid
                debugMode={debugMode}
                isBuilderMode={sceneBuilderMode}
                placementActive={placementMode.active}
            />
            {debugMode ? <DestinationDebugger /> : null}
            {enableOfficeObjects ? <PlacementHandler /> : null}
        </>
    );
}
