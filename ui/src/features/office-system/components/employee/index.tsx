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
 */
import { memo, useCallback, useMemo, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Box, Edges } from "@react-three/drei";
import * as THREE from "three";
import { Book, Brain, CheckSquare, MessageSquare, Monitor, UserCog } from "lucide-react";
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
import type { Id } from "@/lib/entity-types";
import type { AgentState } from "@/lib/openclaw-types";
import { useAppStore } from "@/lib/app-store";
import { getRandomItem } from "@/lib/utils";
import PathVisualizer from "@/features/nav-system/components/path-visualizer";
import type { StatusType } from "@/features/nav-system/components/status-indicator";
import { ContextMenu } from "../context-menu";
import { ProfileHead } from "./ProfileHead";
import {
  LobsterAntennae,
  LobsterClaws,
  LobsterEyes,
  SupervisorHat,
  TeamPlumbob,
} from "./Decorations";
import { EmployeeStatusBubbles } from "./StatusBubbles";
import { useEmployeeLocomotion } from "./use-employee-locomotion";
export interface EmployeeProps {
  _id: Id<"employees">;
  name: string;
  position: [number, number, number];
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
}

const Employee = memo(function Employee({
  _id: id,
  name,
  position,
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
}: EmployeeProps) {
  const employeeIdString = `employee-${id}`;
  const isSelected = useAppStore((state) => state.selectedObjectId === employeeIdString);
  const setSelectedObjectId = useAppStore((state) => state.setSelectedObjectId);
  const setManageAgentEmployeeId = useAppStore((state) => state.setManageAgentEmployeeId);
  const setViewComputerEmployeeId = useAppStore((state) => state.setViewComputerEmployeeId);
  const viewComputerEmployeeId = useAppStore((state) => state.viewComputerEmployeeId);
  const setTrainingEmployeeId = useAppStore((state) => state.setTrainingEmployeeId);
  const setMemoryPanelEmployeeId = useAppStore((state) => state.setMemoryPanelEmployeeId);
  const setIsTeamPanelOpen = useAppStore((state) => state.setIsTeamPanelOpen);
  const setActiveTeamId = useAppStore((state) => state.setActiveTeamId);
  const setSelectedTeamId = useAppStore((state) => state.setSelectedTeamId);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const setKanbanFocusAgentId = useAppStore((state) => state.setKanbanFocusAgentId);
  const highlightedEmployeeIds = useAppStore((state) => state.highlightedEmployeeIds);

  const [isHovered, setIsHovered] = useState(false);
  const isHighlighted = highlightedEmployeeIds.has(id);
  const isViewComputerOpen = viewComputerEmployeeId === id;

  const { groupRef, debugDeskDecision, debugPathData, isGoingToDesk } = useEmployeeLocomotion({
    id,
    position,
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
        onClick: () => {
          setSelectedObjectId(null);
          onClick(id);
        },
      },
      {
        id: "view-pc",
        label: "View PC",
        icon: Monitor,
        color: "green",
        position: "right" as const,
        onClick: () => {
          setViewComputerEmployeeId(id);
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
        id: "kanban",
        label: "Kanban",
        icon: CheckSquare,
        color: "purple",
        position: "left" as const,
        onClick: () => {
          const employeeId = String(id);
          const focusedAgentId = employeeId.startsWith("employee-")
            ? employeeId.replace(/^employee-/, "")
            : employeeId;
          const selectedTeamIdFromEmployee = String(teamId ?? "");
          const selectedTeam = String(
            (useAppStore.getState().activeChatParticipant as { teamId?: string } | null)
              ?.teamId ?? "",
          );

          setSelectedObjectId(null);
          setKanbanFocusAgentId(focusedAgentId);
          if (selectedTeamIdFromEmployee) {
            setActiveTeamId(selectedTeamIdFromEmployee);
            setSelectedTeamId(selectedTeamIdFromEmployee);
            if (selectedTeamIdFromEmployee.startsWith("team-")) {
              setSelectedProjectId(selectedTeamIdFromEmployee.replace(/^team-/, ""));
            }
          } else if (selectedTeam) {
            setActiveTeamId(selectedTeam);
            setSelectedTeamId(selectedTeam);
            if (selectedTeam.startsWith("team-")) {
              setSelectedProjectId(selectedTeam.replace(/^team-/, ""));
            }
          }
          setIsTeamPanelOpen(true);
        },
      },
      {
        id: "training",
        label: "Training",
        icon: Book,
        color: "indigo",
        onClick: () => {
          setTrainingEmployeeId(id);
        },
      },
      {
        id: "memory",
        label: "Memory",
        icon: Brain,
        color: "cyan",
        onClick: () => {
          setMemoryPanelEmployeeId(id);
        },
      },
    ],
    [
      id,
      onClick,
      setActiveTeamId,
      setIsTeamPanelOpen,
      setKanbanFocusAgentId,
      setManageAgentEmployeeId,
      setMemoryPanelEmployeeId,
      setSelectedObjectId,
      setSelectedProjectId,
      setSelectedTeamId,
      setTrainingEmployeeId,
      setViewComputerEmployeeId,
      teamId,
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
  useFrame(() => {
    if (groupRef.current) {
      if (
        hoverScale === 1 &&
        Math.abs(groupRef.current.scale.x - 1) < 0.001 &&
        Math.abs(groupRef.current.scale.y - 1) < 0.001 &&
        Math.abs(groupRef.current.scale.z - 1) < 0.001
      ) {
        return;
      }
      const targetScale = new THREE.Vector3(hoverScale, hoverScale, hoverScale);
      groupRef.current.scale.lerp(targetScale, 0.1);
    }
  });

  const baseY = -TOTAL_HEIGHT / 2;

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
        <Box args={[BODY_WIDTH, LEG_HEIGHT, BODY_WIDTH * 0.6]} position={[0, baseY + LEG_HEIGHT / 2, 0]} castShadow>
          <meshStandardMaterial color={finalColors.pants} />
        </Box>
        <Box args={[BODY_WIDTH, BODY_HEIGHT, BODY_WIDTH * 0.6]} position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT / 2, 0]} castShadow>
          <meshStandardMaterial color={finalColors.shirt} />
        </Box>

        {profileImageUrl && profileImageUrl.trim().length > 0 ? (
          <ProfileHead
            imageUrl={profileImageUrl}
            position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT / 2, 0]}
            skinColor={finalColors.skin}
            hairColor={finalColors.hair}
          />
        ) : (
          <Box
            args={[HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH]}
            position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT / 2, 0]}
            castShadow
          >
            <meshStandardMaterial color={finalColors.skin} />
          </Box>
        )}

        <group position={[0, baseY + LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT + HAIR_HEIGHT / 2, 0]}>
          <Box args={[HAIR_WIDTH, HAIR_HEIGHT, HAIR_WIDTH]} castShadow>
            <meshStandardMaterial color={finalColors.hair} />
          </Box>
          {isSupervisor ? <SupervisorHat /> : null}
        </group>

        <LobsterClaws color={finalColors.shirt} />
        <LobsterAntennae />
        <LobsterEyes />
        <TeamPlumbob teamId={teamId} />

        {(isHovered || isSelected) && (
          <Edges
            scale={1.1}
            color={isSelected ? "#00ff00" : "#ffffff"}
            lineWidth={isSelected ? 2 : 1}
          />
        )}

        <EmployeeStatusBubbles
          currentStatus={currentStatus}
          statusMessage={statusMessage}
          effectiveNotificationCount={effectiveNotificationCount}
          heartbeatState={heartbeatState}
          heartbeatBubbles={heartbeatBubbles}
          isHovered={isHovered}
          isHighlighted={isHighlighted}
          name={name}
          jobTitle={jobTitle}
          team={team}
          totalHeight={TOTAL_HEIGHT}
          debugMode={debugMode}
          debugDeskDecision={debugDeskDecision}
        />

        <ContextMenu
          isOpen={isSelected}
          onClose={() => setSelectedObjectId(null)}
          actions={employeeActions}
          title={name}
        />
      </group>

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
