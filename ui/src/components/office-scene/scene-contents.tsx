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
import { SmartGrid } from '@/components/debug/unified-grid-helper';
import { DestinationDebugger } from '@/components/debug/destination-debugger';
import { PlacementHandler } from '@/components/placement-handler';
import type { StatusType } from '@/features/nav-system/components/status-indicator';
import { OfficeLighting } from './office-lighting';
import { OfficeRoomShell } from './office-room-shell';
import { OfficeObjectRenderer } from './office-object-renderer';
import { useOfficeSceneTheme, useOfficeSceneCameraTransition } from './use-office-scene-camera';
import { useOfficeSceneInteractions } from './use-office-scene-interactions';
import { useOfficeSceneBootstrap } from './use-office-scene-bootstrap';
import { useOfficeSceneDerivedData } from './use-office-scene-derived-data';
import type { OfficeSceneProps } from './types';

export function SceneContents(props: OfficeSceneProps): JSX.Element {
    const { teams, employees, desks, officeObjects, companyId, onNavigationReady } = props;
    const enableOfficeObjects = import.meta.env.VITE_ENABLE_OFFICE_OBJECTS !== 'false';

    const isBuilderMode = useAppStore((state) => state.isBuilderMode);
    const debugMode = useAppStore((state) => state.debugMode);
    const isAnimatingCamera = useAppStore((state) => state.isAnimatingCamera);
    const setAnimatingCamera = useAppStore((state) => state.setAnimatingCamera);
    const isDragging = useAppStore((state) => state.isDragging);
    const placementMode = useAppStore((state) => state.placementMode);

    const officeTheme = useOfficeSceneTheme();
    const sceneBuilderMode = isAnimatingCamera ? false : isBuilderMode;

    const glassWallObjects = useMemo(
        () =>
            (officeObjects ?? [])
                .filter((object) => object.meshType === 'glass-wall')
                .map((object) => ({ position: object.position as [number, number, number] })),
        [officeObjects],
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
        officeObjectCount: officeObjects?.length ?? 0,
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
        orbitControlsRef,
        setAnimatingCamera,
    });

    const officeObjectsRendered = useMemo(() => {
        if (!enableOfficeObjects) return null;
        return (
            <OfficeObjectRenderer
                officeObjects={officeObjects}
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
        officeObjects,
        teamById,
    ]);

    return (
        <>
            <OfficeLighting officeTheme={officeTheme} sceneBuilderMode={sceneBuilderMode} />

            <OrbitControls
                ref={orbitControlsRef}
                enabled={!isDragging}
                enableRotate={!isDragging}
                enablePan={!isDragging}
                enableZoom
                maxPolarAngle={sceneBuilderMode ? Math.PI / 3 : Math.PI}
                minPolarAngle={0}
            />

            <OfficeRoomShell
                floorRef={floorRef}
                officeTheme={officeTheme}
                onBackgroundClick={handleBackgroundClick}
            />

            {ceoDeskData && (
                <group ref={ceoDeskRef} name="obstacle-ceoDeskGroup">
                    <Desk
                        key={ceoDeskData.id}
                        deskId={ceoDeskData.id}
                        position={ceoDeskData.position}
                        rotationY={ceoDeskData.rotationY}
                        isHovered={false}
                        onClick={handleCeoDeskClick}
                    />
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
