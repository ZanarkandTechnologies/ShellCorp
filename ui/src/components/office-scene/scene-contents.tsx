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

"use client";

import { OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import { DestinationDebugger } from "@/components/debug/destination-debugger";
import { SmartGrid } from "@/components/debug/unified-grid-helper";
import { PlacementHandler } from "@/components/placement-handler";
import type { StatusType } from "@/features/nav-system/components/status-indicator";
import { Employee } from "@/features/office-system/components/employee";
import { useAppStore } from "@/lib/app-store";
import { OfficeLayoutEditor } from "./office-layout-editor";
import { OfficeLighting } from "./office-lighting";
import { OfficeObjectRenderer } from "./office-object-renderer";
import { OfficeRoomShell } from "./office-room-shell";
import type { OfficeSceneProps } from "./types";
import { useOfficeSceneBootstrap } from "./use-office-scene-bootstrap";
import { useOfficeSceneCameraTransition, useOfficeSceneTheme } from "./use-office-scene-camera";
import { useOfficeSceneDerivedData } from "./use-office-scene-derived-data";
import { useOfficeSceneInteractions } from "./use-office-scene-interactions";
import { getOfficeSceneViewState, isFixedOfficeSceneView } from "./view-profile";

export function SceneContents(props: OfficeSceneProps): JSX.Element {
  const {
    teams,
    employees,
    desks,
    officeObjects,
    officeFootprint,
    officeLayout,
    officeDecorSettings,
    officeViewSettings,
    companyId,
    onNavigationReady,
  } = props;
  const enableOfficeObjects = import.meta.env.VITE_ENABLE_OFFICE_OBJECTS !== "false";

  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const debugMode = useAppStore((state) => state.debugMode);
  const isAnimatingCamera = useAppStore((state) => state.isAnimatingCamera);
  const setAnimatingCamera = useAppStore((state) => state.setAnimatingCamera);
  const isDragging = useAppStore((state) => state.isDragging);
  const placementMode = useAppStore((state) => state.placementMode);
  const activeBuilderTool = useAppStore((state) => state.activeBuilderTool);

  const officeTheme = useOfficeSceneTheme();
  const sceneBuilderMode = isAnimatingCamera ? false : isBuilderMode;
  const isLayoutEditing = sceneBuilderMode && activeBuilderTool !== null;
  // MEM-0170 decision: fixed 2.5D uses compact scene overlays so Html cards cannot occlude the office.
  const useCompactSceneOverlays = isFixedOfficeSceneView(officeViewSettings);
  const viewState = getOfficeSceneViewState({
    isBuilderMode: sceneBuilderMode,
    isDragging,
    settings: officeViewSettings,
  });

  const { employeesForScene, teamById, desksByTeamId } = useOfficeSceneDerivedData({
    teams,
    employees,
    desks,
    officeViewSettings,
  });

  const { orbitControlsRef, floorRef, createRegisteredObjectRef, getObjectRef } =
    useOfficeSceneBootstrap({
      officeLayout,
      officeObjectCount:
        officeObjects?.filter((object) => object.meshType !== "wall-art").length ?? 0,
      onNavigationReady,
    });

  const { handleBackgroundClick, handleEmployeeClick, handleTeamClick, handleCeoDeskClick } =
    useOfficeSceneInteractions({ employees });

  useOfficeSceneCameraTransition({
    isBuilderMode,
    settings: officeViewSettings,
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
        officeFootprint={officeFootprint}
        handleTeamClick={handleTeamClick}
        handleManagementClick={handleCeoDeskClick}
        getObjectRef={getObjectRef}
        createRegisteredObjectRef={createRegisteredObjectRef}
      />
    );
  }, [
    companyId,
    createRegisteredObjectRef,
    desksByTeamId,
    getObjectRef,
    handleTeamClick,
    officeFootprint,
    officeObjects,
    teamById,
    handleCeoDeskClick,
    enableOfficeObjects,
  ]);

  return (
    <>
      <OfficeLighting
        officeTheme={officeTheme}
        officeLayout={officeLayout}
        officeViewSettings={officeViewSettings}
        sceneBuilderMode={sceneBuilderMode}
      />

      <OrbitControls
        ref={orbitControlsRef}
        enabled={viewState.controlsEnabled && !isLayoutEditing}
        enableRotate={viewState.rotateEnabled && !isLayoutEditing}
        enablePan={viewState.panEnabled && !isLayoutEditing}
        enableZoom={viewState.zoomEnabled}
        maxPolarAngle={viewState.maxPolarAngle}
        minPolarAngle={viewState.minPolarAngle}
      />

      <OfficeRoomShell
        floorRef={floorRef}
        officeFootprint={officeFootprint}
        officeLayout={officeLayout}
        officeDecorSettings={officeDecorSettings}
        officeViewSettings={officeViewSettings}
        officeTheme={officeTheme}
        sceneBuilderMode={sceneBuilderMode}
        onBackgroundClick={handleBackgroundClick}
      />
      <OfficeLayoutEditor />
      {!sceneBuilderMode &&
        employeesForScene.map((employee) => (
          <Employee
            key={employee._id}
            _id={employee._id}
            name={employee.name}
            position={employee.initialPosition}
            activityTargetPosition={employee.activityTargetPosition}
            activityTargetObjectPosition={employee.activityTargetObjectPosition}
            activityTargetSkillId={employee.activityTargetSkillId}
            activityEffectVariant={employee.activityEffectVariant}
            isBusy={employee.isBusy}
            isCEO={employee.isCEO}
            isSupervisor={employee.isSupervisor}
            gender={employee.gender}
            onClick={handleEmployeeClick}
            debugMode={debugMode}
            status={(employee.status || "none") as StatusType}
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
            useCompactOverlayMode={useCompactSceneOverlays}
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

