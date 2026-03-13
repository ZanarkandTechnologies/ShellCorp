"use client";
/**
 * EMPLOYEE
 * ========
 * Main office employee avatar shell that composes locomotion, overlays, and decorative meshes.
 *
 * KEY CONCEPTS:
 * - Visual mesh shell stays separate from locomotion state
 * - Avatar overlays are extracted to avoid re-rendering all geometry on label/status changes
 * - The public `Employee` API remains unchanged for `office-scene.tsx`
 *
 * MEMORY REFERENCES:
 * - MEM-0144
 * - MEM-0163
 * - MEM-0188
 */
import { Box, Edges } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { Book, Brain, MessageSquare, Monitor, UserCog } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as THREE from "three";
import {
  BODY_HEIGHT,
  BODY_WIDTH,
  HAIR_COLORS,
  HAIR_HEIGHT,
  HAIR_WIDTH,
  HEAD_HEIGHT,
  HEAD_WIDTH,
  LEG_HEIGHT,
  PANTS_COLORS,
  SHIRT_COLORS,
  SKIN_COLORS,
  TOTAL_HEIGHT,
} from "@/constants";
import PathVisualizer from "@/features/nav-system/components/path-visualizer";
import type { StatusType } from "@/features/nav-system/components/status-indicator";
import { useAppStore } from "@/lib/app-store";
import type { Id } from "@/lib/entity-types";
import type { AgentState } from "@/lib/openclaw-types";
import { getRandomItem } from "@/lib/utils";
import { ContextMenu } from "../context-menu";
import {
  LobsterAntennae,
  LobsterClaws,
  LobsterEyes,
  SupervisorHat,
  TeamPlumbob,
} from "./Decorations";
import { getEmployeeAnimationPose } from "./employee-motion";
import { ProfileHead } from "./ProfileHead";
import { EmployeeStatusBubbles } from "./StatusBubbles";
import { useEmployeeLocomotion } from "./use-employee-locomotion";

type AvatarPalette = {
  hair: string;
  skin: string;
  shirt: string;
  pants: string;
};

export interface EmployeeProps {
  _id: Id<"employees">;
  name: string;
  position: [number, number, number];
  activityTargetPosition?: [number, number, number];
  activityTargetObjectPosition?: [number, number, number];
  activityTargetSkillId?: string;
  activityEffectVariant?: "ghost" | "blink";
  isBusy?: boolean;
  isCEO?: boolean;
  isSupervisor?: boolean;
  gender?: string;
  onClick: (employeeId: Id<"employees">) => void;
  debugMode?: boolean;
  status?: StatusType;
  statusMessage?: string;
  wantsToWander?: boolean;
  jobTitle?: string;
  team?: string;
  teamId?: string;
  notificationCount?: number;
  notificationPriority?: number;
  heartbeatState?: AgentState;
  heartbeatBubbles?: Array<{ label: string; weight?: number }>;
  profileImageUrl?: string;
  useCompactOverlayMode?: boolean;
}

function AvatarShell({
  colors,
  profileImageUrl,
  isSupervisor,
  teamId,
  useCompactOverlayMode,
  projection = false,
}: {
  colors: AvatarPalette;
  profileImageUrl?: string;
  isSupervisor?: boolean;
  teamId?: string;
  useCompactOverlayMode?: boolean;
  projection?: boolean;
}) {
  const baseY = -TOTAL_HEIGHT / 2;
  const materialProps = projection ? { transparent: true, opacity: 0.48 } : {};
  const projectionHeadColor = projection ? "#67e8f9" : colors.skin;
  const projectionHairColor = projection ? "#a5f3fc" : colors.hair;
  const projectionShirtColor = projection ? "#22d3ee" : colors.shirt;
  const projectionPantsColor = projection ? "#0f766e" : colors.pants;

  return (
    <group>
      <Box
        args={[BODY_WIDTH, LEG_HEIGHT, BODY_WIDTH * 0.6]}
        position={[0, baseY + LEG_HEIGHT / 2, 0]}
        castShadow={!projection}
      >
        <meshStandardMaterial color={projectionPantsColor} {...materialProps} />
      </Box>
      <Box
        args={[BODY_WIDTH, BODY_HEIGHT, BODY_WIDTH * 0.6]}
        position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT / 2, 0]}
        castShadow={!projection}
      >
        <meshStandardMaterial color={projectionShirtColor} {...materialProps} />
      </Box>

      {profileImageUrl && profileImageUrl.trim().length > 0 && !projection ? (
        <ProfileHead
          imageUrl={profileImageUrl}
          position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT / 2, 0]}
          skinColor={colors.skin}
          hairColor={colors.hair}
          useCompactOverlayMode={useCompactOverlayMode}
        />
      ) : (
        <Box
          args={[HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH]}
          position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT / 2, 0]}
          castShadow={!projection}
        >
          <meshStandardMaterial color={projectionHeadColor} {...materialProps} />
        </Box>
      )}

      <group position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT + HAIR_HEIGHT / 2, 0]}>
        <Box args={[HAIR_WIDTH, HAIR_HEIGHT, HAIR_WIDTH]} castShadow={!projection}>
          <meshStandardMaterial color={projectionHairColor} {...materialProps} />
        </Box>
        {isSupervisor ? <SupervisorHat /> : null}
      </group>

      <LobsterClaws color={projectionShirtColor} />
      <LobsterAntennae />
      <LobsterEyes />
      {!projection ? <TeamPlumbob teamId={teamId} /> : null}
    </group>
  );
}

const Employee = memo(function Employee({
  _id: id,
  name,
  position,
  activityTargetPosition,
  activityTargetObjectPosition,
  activityTargetSkillId,
  activityEffectVariant,
  isBusy,
  isCEO,
  isSupervisor,
  onClick,
  profileImageUrl,
  debugMode = false,
  status = "none" as StatusType,
  statusMessage,
  wantsToWander = true,
  jobTitle,
  team,
  teamId,
  notificationCount = 0,
  notificationPriority = 0,
  heartbeatState,
  heartbeatBubbles = [],
  useCompactOverlayMode = false,
}: EmployeeProps) {
  const employeeIdString = `employee-${id}`;
  const isSelected = useAppStore((state) => state.selectedObjectId === employeeIdString);
  const setSelectedObjectId = useAppStore((state) => state.setSelectedObjectId);
  const setManageAgentEmployeeId = useAppStore((state) => state.setManageAgentEmployeeId);
  const setMemoryPanelEmployeeId = useAppStore((state) => state.setMemoryPanelEmployeeId);
  const setKanbanFocusAgentId = useAppStore((state) => state.setKanbanFocusAgentId);
  const setIsSkillsPanelOpen = useAppStore((state) => state.setIsSkillsPanelOpen);
  const setSelectedSkillStudioSkillId = useAppStore((state) => state.setSelectedSkillStudioSkillId);
  const setSkillStudioFocusAgentId = useAppStore((state) => state.setSkillStudioFocusAgentId);
  const highlightedEmployeeIds = useAppStore((state) => state.highlightedEmployeeIds);
  const isOfficeOnboardingVisible = useAppStore((state) => state.isOfficeOnboardingVisible);
  const officeOnboardingStep = useAppStore((state) => state.officeOnboardingStep);

  const [isHovered, setIsHovered] = useState(false);
  const isHighlighted = highlightedEmployeeIds.has(id);
  const avatarRef = useRef<THREE.Group>(null);
  const projectionRef = useRef<THREE.Group>(null);
  const activityLineGeometryRef = useRef<THREE.BufferGeometry>(null);
  const projectionPulseRef = useRef<THREE.Mesh>(null);
  const projectionRingRef = useRef<THREE.Mesh>(null);
  const sourcePulseRef = useRef<THREE.Mesh>(null);
  const blinkRingRef = useRef<THREE.Mesh>(null);
  const activityEffectStartedAtRef = useRef<number>(0);
  const lastActivityEffectKeyRef = useRef("");

  const { groupRef, debugDeskDecision, debugPathData, isGoingToDesk, animationMode } =
    useEmployeeLocomotion({
      id,
      position,
      activityTargetPosition,
      activityTargetSkillId,
      activityEffectVariant,
      isBusy,
      isCEO,
      wantsToWander,
      heartbeatState,
      debugMode,
    });

  const colors = useMemo(
    () => ({
      hair: getRandomItem(HAIR_COLORS),
      skin: getRandomItem(SKIN_COLORS),
      shirt: getRandomItem(SHIRT_COLORS),
      pants: getRandomItem(PANTS_COLORS),
    }),
    [],
  );

  const finalColors = useMemo(
    () =>
      isCEO
        ? {
            hair: "#FFD700",
            skin: "#FF5722",
            shirt: "#CC2200",
            pants: "#8B0000",
          }
        : colors,
    [isCEO, colors],
  );

  const { currentStatus, effectiveNotificationCount } = useMemo(() => {
    if (notificationCount > 0 && notificationPriority > 0) {
      let indicatorStatus: StatusType = "info";
      if (notificationPriority === 3) {
        indicatorStatus = "warning";
      } else if (notificationPriority === 2) {
        indicatorStatus = "question";
      }
      return {
        currentStatus: indicatorStatus,
        effectiveNotificationCount: notificationCount,
      };
    }

    if (status && status !== "none") {
      return { currentStatus: status, effectiveNotificationCount: 0 };
    }

    if (isBusy) {
      return { currentStatus: "info" as StatusType, effectiveNotificationCount: 0 };
    }

    return { currentStatus: "none" as StatusType, effectiveNotificationCount: 0 };
  }, [status, isBusy, notificationCount, notificationPriority]);

  const employeeActions = useMemo(
    () => [
      {
        id: "chat",
        label: "Chat",
        icon: MessageSquare,
        color: "blue",
        position: "top" as const,
        isHighlighted:
          isOfficeOnboardingVisible && officeOnboardingStep === "open-chat" && Boolean(isCEO),
        onClick: () => {
          setSelectedObjectId(null);
          onClick(id);
        },
      },
      {
        id: "computer",
        label: "Computer",
        icon: Monitor,
        color: "green",
        position: "right" as const,
        onClick: () => {
          toast.info("Computer view is hidden for this demo.");
        },
      },
      {
        id: "manage",
        label: "Manage",
        icon: UserCog,
        color: "amber",
        position: "bottom" as const,
        onClick: () => {
          setManageAgentEmployeeId(id);
        },
      },
      {
        id: "training",
        label: "Skills",
        icon: Book,
        color: "indigo",
        onClick: () => {
          const employeeId = String(id);
          const focusedAgentId = employeeId.startsWith("employee-")
            ? employeeId.replace(/^employee-/, "")
            : employeeId;
          setSelectedSkillStudioSkillId(null);
          setSkillStudioFocusAgentId(focusedAgentId);
          setIsSkillsPanelOpen(true);
        },
      },
      {
        id: "memory",
        label: "Context",
        icon: Brain,
        color: "purple",
        position: "left" as const,
        onClick: () => {
          const employeeId = String(id);
          const focusedAgentId = employeeId.startsWith("employee-")
            ? employeeId.replace(/^employee-/, "")
            : employeeId;
          setSelectedObjectId(null);
          setKanbanFocusAgentId(focusedAgentId);
          setMemoryPanelEmployeeId(id);
        },
      },
    ],
    [
      id,
      onClick,
      setKanbanFocusAgentId,
      isOfficeOnboardingVisible,
      setIsSkillsPanelOpen,
      setManageAgentEmployeeId,
      setMemoryPanelEmployeeId,
      setSelectedSkillStudioSkillId,
      setSkillStudioFocusAgentId,
      officeOnboardingStep,
      setSelectedObjectId,
      isCEO,
    ],
  );

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      setSelectedObjectId(isSelected ? null : employeeIdString);
    },
    [employeeIdString, isSelected, setSelectedObjectId],
  );

  const hoverScale = isHovered && !isSelected ? 1.05 : 1;
  const animationPhase = useMemo(() => {
    return Array.from(String(id)).reduce((phase, character, index) => {
      return phase + character.charCodeAt(0) * (index + 1) * 0.01;
    }, 0);
  }, [id]);
  const isGhostProjectionActive =
    activityEffectVariant === "ghost" &&
    Array.isArray(activityTargetPosition) &&
    Array.isArray(activityTargetObjectPosition);
  const isBlinkEffectActive =
    activityEffectVariant === "blink" && Array.isArray(activityTargetPosition);
  const activityEffectKey = useMemo(
    () =>
      [
        activityEffectVariant ?? "",
        activityTargetSkillId ?? "",
        activityTargetPosition?.join(",") ?? "",
      ].join("|"),
    [activityEffectVariant, activityTargetPosition, activityTargetSkillId],
  );

  useEffect(() => {
    if (!activityEffectKey.replace(/\|/g, "")) {
      lastActivityEffectKeyRef.current = "";
      return;
    }
    if (lastActivityEffectKeyRef.current === activityEffectKey) {
      return;
    }
    lastActivityEffectKeyRef.current = activityEffectKey;
    activityEffectStartedAtRef.current = performance.now();
  }, [activityEffectKey]);

  useFrame((state) => {
    if (groupRef.current) {
      const isAtRestScale =
        hoverScale === 1 &&
        Math.abs(groupRef.current.scale.x - 1) < 0.001 &&
        Math.abs(groupRef.current.scale.y - 1) < 0.001 &&
        Math.abs(groupRef.current.scale.z - 1) < 0.001;

      if (!isAtRestScale) {
        const targetScale = new THREE.Vector3(hoverScale, hoverScale, hoverScale);
        groupRef.current.scale.lerp(targetScale, 0.1);
      }
    }

    if (avatarRef.current) {
      const pose = getEmployeeAnimationPose(state.clock.elapsedTime, animationPhase, animationMode);
      avatarRef.current.position.y = pose.bobY;
      avatarRef.current.rotation.z = pose.rollZ;
      avatarRef.current.rotation.y = pose.yawY;
    }

    if (projectionRef.current && activityEffectVariant === "ghost" && activityTargetPosition) {
      const effectElapsed = (performance.now() - activityEffectStartedAtRef.current) / 1000;
      const shimmer = Math.sin(state.clock.elapsedTime * 3 + animationPhase) * 0.08;
      projectionRef.current.position.y = activityTargetPosition[1] + shimmer;
      const settleScale = THREE.MathUtils.lerp(0.4, 0.94, Math.min(effectElapsed / 0.28, 1));
      projectionRef.current.scale.setScalar(settleScale);
      projectionRef.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 1.7 + animationPhase) * 0.08;
    }

    if (projectionPulseRef.current && isGhostProjectionActive) {
      const effectElapsed = (performance.now() - activityEffectStartedAtRef.current) / 1000;
      const pulseScale = 0.85 + Math.min(effectElapsed * 2.1, 1.45);
      projectionPulseRef.current.scale.setScalar(pulseScale);
      const material = projectionPulseRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.24 - effectElapsed * 0.15);
    }

    if (projectionRingRef.current && isGhostProjectionActive) {
      const effectElapsed = (performance.now() - activityEffectStartedAtRef.current) / 1000;
      const ringScale = 0.75 + Math.min(effectElapsed * 3.2, 1.95);
      projectionRingRef.current.scale.set(ringScale, ringScale, ringScale);
      const material = projectionRingRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.92 - effectElapsed * 1.55);
    }

    if (sourcePulseRef.current && isGhostProjectionActive) {
      const effectElapsed = (performance.now() - activityEffectStartedAtRef.current) / 1000;
      const pulseScale = 0.7 + Math.min(effectElapsed * 1.9, 1.3);
      sourcePulseRef.current.scale.set(pulseScale, 1, pulseScale);
      const material = sourcePulseRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.58 - effectElapsed * 1.1);
    }

    if (blinkRingRef.current && isBlinkEffectActive) {
      const effectElapsed = (performance.now() - activityEffectStartedAtRef.current) / 1000;
      const ringScale = 0.7 + Math.min(effectElapsed * 4.6, 2.8);
      blinkRingRef.current.scale.set(ringScale, ringScale, ringScale);
      const material = blinkRingRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.96 - effectElapsed * 1.9);
    }

    if (
      activityLineGeometryRef.current &&
      isGhostProjectionActive &&
      activityTargetObjectPosition &&
      groupRef.current
    ) {
      const currentPosition = groupRef.current.position;
      activityLineGeometryRef.current.setFromPoints([
        new THREE.Vector3(0, TOTAL_HEIGHT * 0.62, 0),
        new THREE.Vector3(
          activityTargetObjectPosition[0] - currentPosition.x,
          activityTargetObjectPosition[1] - currentPosition.y + TOTAL_HEIGHT * 0.2,
          activityTargetObjectPosition[2] - currentPosition.z,
        ),
      ]);
    }
  });
  const projectionStatus = isGhostProjectionActive ? currentStatus : ("none" as StatusType);
  const onboardingPrompt =
    isOfficeOnboardingVisible && isCEO
      ? officeOnboardingStep === "click-ceo"
        ? "Click me"
        : officeOnboardingStep === "open-chat" && isSelected
          ? "Open Chat"
          : null
      : null;

  return (
    <>
      <group
        ref={groupRef}
        name={`employee-${id}`}
        castShadow
        onClick={handleClick}
        onPointerEnter={(event) => {
          event.stopPropagation();
          setIsHovered(true);
        }}
        onPointerLeave={(event) => {
          event.stopPropagation();
          setIsHovered(false);
        }}
      >
        <group ref={avatarRef}>
          <AvatarShell
            colors={finalColors}
            profileImageUrl={profileImageUrl}
            isSupervisor={isSupervisor}
            teamId={teamId}
            useCompactOverlayMode={useCompactOverlayMode}
          />
        </group>

        {isGhostProjectionActive ? (
          <mesh
            ref={sourcePulseRef}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -TOTAL_HEIGHT / 2 + 0.03, 0]}
          >
            <ringGeometry args={[0.38, 0.7, 32]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.5} />
          </mesh>
        ) : null}

        {(isHovered || isSelected) && (
          <Edges
            scale={1.1}
            color={isSelected ? "#00ff00" : "#ffffff"}
            lineWidth={isSelected ? 2 : 1}
          />
        )}

        {isGhostProjectionActive ? (
          <line>
            <bufferGeometry ref={activityLineGeometryRef} attach="geometry" />
            <lineBasicMaterial attach="material" color="#f59e0b" transparent opacity={0.75} />
          </line>
        ) : null}

        <EmployeeStatusBubbles
          currentStatus={isGhostProjectionActive ? ("none" as StatusType) : currentStatus}
          statusMessage={isGhostProjectionActive ? undefined : statusMessage}
          effectiveNotificationCount={isGhostProjectionActive ? 0 : effectiveNotificationCount}
          heartbeatState={heartbeatState}
          heartbeatBubbles={isGhostProjectionActive ? [] : heartbeatBubbles}
          isHovered={isHovered}
          isHighlighted={isHighlighted}
          name={name}
          jobTitle={jobTitle}
          team={team}
          totalHeight={TOTAL_HEIGHT}
          debugMode={debugMode}
          debugDeskDecision={debugDeskDecision}
          onboardingPrompt={onboardingPrompt}
          useCompactOverlayMode={useCompactOverlayMode}
        />

        <ContextMenu
          isOpen={isSelected}
          onClose={() => setSelectedObjectId(null)}
          actions={employeeActions}
          title={name}
        />
      </group>

      {isGhostProjectionActive && activityTargetPosition ? (
        <group
          ref={projectionRef}
          position={activityTargetPosition}
          scale={[0.94, 0.94, 0.94]}
          name={`employee-projection-${id}`}
        >
          <mesh ref={projectionPulseRef} position={[0, TOTAL_HEIGHT * 0.5, 0]}>
            <sphereGeometry args={[0.72, 14, 14]} />
            <meshBasicMaterial color="#67e8f9" transparent opacity={0.18} />
          </mesh>
          <mesh
            ref={projectionRingRef}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -TOTAL_HEIGHT / 2 + 0.03, 0]}
          >
            <ringGeometry args={[0.44, 0.86, 36]} />
            <meshBasicMaterial color="#67e8f9" transparent opacity={0.9} />
          </mesh>
          <AvatarShell colors={finalColors} isSupervisor={isSupervisor} projection />
          <EmployeeStatusBubbles
            currentStatus={projectionStatus}
            statusMessage={statusMessage}
            effectiveNotificationCount={0}
            heartbeatState={heartbeatState}
            heartbeatBubbles={heartbeatBubbles}
            isHovered={false}
            isHighlighted={false}
            name={name}
            jobTitle={jobTitle}
            team={team}
            totalHeight={TOTAL_HEIGHT}
            debugMode={false}
            debugDeskDecision=""
            onboardingPrompt={null}
            useCompactOverlayMode={useCompactOverlayMode}
          />
        </group>
      ) : null}

      {isBlinkEffectActive && activityTargetPosition ? (
        <mesh
          ref={blinkRingRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[
            activityTargetPosition[0],
            activityTargetPosition[1] + 0.03,
            activityTargetPosition[2],
          ]}
        >
          <ringGeometry args={[0.5, 1.0, 40]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.96} />
        </mesh>
      ) : null}

      {debugMode && (debugPathData.originalPath || debugPathData.remainingPath) ? (
        <PathVisualizer
          originalPath={debugPathData.originalPath}
          remainingPath={debugPathData.remainingPath}
          isGoingToDesk={isGoingToDesk}
          employeeId={id}
        />
      ) : null}
    </>
  );
});

export { Employee };
