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
import { useFrame } from "@react-three/fiber";
import { useMemo, useState, useRef, useEffect } from "react";
import * as THREE from "three";
import { DestinationDebugger } from "@/components/debug/destination-debugger";
import { SmartGrid } from "@/components/debug/unified-grid-helper";
import { PlacementHandler } from "@/components/placement-handler";
import type { StatusType } from "@/features/nav-system/components/status-indicator";
import { Employee } from "@/features/office-system/components/employee";
import { useAppStore } from "@/lib/app-store";
import { useChatStore } from "@/features/chat-system/chat-store";
import { extractAgentId } from "@/lib/entity-utils";
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
import { getOfficeLayoutBounds } from "@/lib/office-layout";

/** Clamps orthographic camera zoom to [minZoom, maxZoom] each frame when in fixed 2.5D. */
function ZoomClamp({ minZoom, maxZoom }: { minZoom: number; maxZoom: number }) {
  useFrame((state) => {
    const camera = state.camera as THREE.OrthographicCamera;
    if (!camera.isOrthographicCamera) return;
    const z = camera.zoom;
    if (z < minZoom) camera.zoom = minZoom;
    else if (z > maxZoom) camera.zoom = maxZoom;
    if (camera.zoom !== z) camera.updateProjectionMatrix();
  });
  return null;
}

/** Returns current orthographic zoom, updating only when zoom changes beyond threshold. */
function useCameraZoomWhenFixed(minZoom: number, maxZoom: number, enabled: boolean) {
  const [zoom, setZoom] = useState(() => minZoom + (maxZoom - minZoom) * 0.5);
  const last = useRef(zoom);
  useFrame((state) => {
    if (!enabled) return;
    const camera = state.camera as THREE.OrthographicCamera;
    if (!camera.isOrthographicCamera) return;
    const z = camera.zoom;
    if (Math.abs(z - last.current) > 0.08) {
      last.current = z;
      setZoom(z);
    }
  });
  useEffect(() => {
    if (!enabled) last.current = zoom;
  }, [enabled, zoom]);
  return zoom;
}

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
  const isChatOpen = useChatStore((state) => state.isChatOpen);
  const currentEmployeeId = useChatStore((state) => state.currentEmployeeId);
  const presentationMode = useChatStore((state) => state.presentationMode);
  const selectedAgentId = useAppStore((state) => state.selectedAgentId);
  const isStoryMode = isChatOpen && presentationMode === "story";

  const officeTheme = useOfficeSceneTheme();
  const sceneBuilderMode = isAnimatingCamera ? false : isBuilderMode;
  const shouldForceBuilderPerspective =
    sceneBuilderMode && officeViewSettings.viewProfile === "fixed_2_5d";
  const forcePerspective = isStoryMode || shouldForceBuilderPerspective;
  const isLayoutEditing = sceneBuilderMode && activeBuilderTool !== null;
  // MEM-0170 decision: fixed 2.5D uses compact scene overlays so Html cards cannot occlude the office.
  const useCompactSceneOverlays = isStoryMode ? false : isFixedOfficeSceneView(officeViewSettings);
  const layoutCenter = useMemo(() => {
    const bounds = getOfficeLayoutBounds(officeLayout);
    return { x: bounds.centerX, z: bounds.centerZ };
  }, [officeLayout]);
  const viewState = getOfficeSceneViewState({
    isBuilderMode: sceneBuilderMode,
    isDragging,
    settings: officeViewSettings,
    forcePerspective,
    layoutCenter,
  });
  const isFixed25 = isFixedOfficeSceneView(officeViewSettings) && !forcePerspective;
  const minZoom = viewState.minZoom ?? 12;
  const maxZoom = viewState.maxZoom ?? 55;
  const cameraZoom = useCameraZoomWhenFixed(minZoom, maxZoom, isFixed25);

  const { employeesForScene, teamById, desksByTeamId } = useOfficeSceneDerivedData({
    teams,
    employees,
    desks,
    officeViewSettings,
  });
  const consultCameraTarget = useMemo<[number, number, number] | null>(() => {
    if (!isChatOpen || presentationMode !== "story") return null;
    const fallbackEmployeeId = (() => {
      const agentId = extractAgentId(selectedAgentId);
      return agentId ? `employee-${agentId}` : null;
    })();
    const resolvedEmployeeId = currentEmployeeId ?? fallbackEmployeeId;
    if (!resolvedEmployeeId) return null;
    const employee = employeesForScene.find((item) => item._id === resolvedEmployeeId);
    return employee?.position ?? employee?.initialPosition ?? null;
  }, [currentEmployeeId, employeesForScene, isChatOpen, presentationMode, selectedAgentId]);

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
    consultCameraTarget,
    forcePerspective,
    layoutCenter,
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
    handleCeoDeskClick,
    handleTeamClick,
    officeFootprint,
    officeObjects,
    teamById,
  ]);

  return (
    <>
      <OfficeLighting
        officeTheme={officeTheme}
        officeLayout={officeLayout}
        officeViewSettings={officeViewSettings}
        sceneBuilderMode={sceneBuilderMode}
      />

      {isFixed25 && viewState.minZoom != null && viewState.maxZoom != null ? (
        <ZoomClamp minZoom={viewState.minZoom} maxZoom={viewState.maxZoom} />
      ) : null}

      <OrbitControls
        ref={orbitControlsRef}
        enabled={viewState.controlsEnabled && !isLayoutEditing && !consultCameraTarget}
        enableRotate={viewState.rotateEnabled && !isLayoutEditing && !consultCameraTarget}
        enablePan={viewState.panEnabled && !consultCameraTarget}
        enableZoom={viewState.zoomEnabled && !consultCameraTarget}
        panSpeed={sceneBuilderMode ? 0.75 : 1}
        zoomSpeed={sceneBuilderMode ? 0.75 : 1}
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
        cameraZoom={isFixed25 ? cameraZoom : undefined}
        zoomRange={isFixed25 ? { minZoom, maxZoom } : undefined}
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
