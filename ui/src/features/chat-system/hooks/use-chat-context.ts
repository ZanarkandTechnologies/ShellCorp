"use client";

import { useMemo } from "react";
import { useChatStore } from "@/features/chat-system/chat-store";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useAppStore } from "@/lib/app-store";
import {
  getDisplayInitials,
  type StoryChatPersona,
} from "@/features/chat-system/story-chat-display";
import { extractAgentId } from "@/lib/entity-utils";

export function useChatContext(): {
  headerTitle: string;
  headerSubtitle?: string;
  currentEmployeeId: string | null;
  isEmployeeScopedChat: boolean;
  storyPersona: StoryChatPersona;
} {
  const currentEmployeeId = useChatStore((state) => state.currentEmployeeId);
  const currentTeamId = useChatStore((state) => state.currentTeamId);
  const selectedAgentId = useAppStore((state) => state.selectedAgentId);
  const { employees, teams } = useOfficeDataContext();
  const fallbackEmployeeId = useMemo(() => {
    const agentId = extractAgentId(selectedAgentId);
    return agentId ? `employee-${agentId}` : null;
  }, [selectedAgentId]);
  const resolvedEmployeeId = currentEmployeeId ?? fallbackEmployeeId;

  const employee = useMemo(
    () => employees.find((item) => item._id === resolvedEmployeeId),
    [employees, resolvedEmployeeId],
  );
  const team = useMemo(
    () => teams.find((item) => item._id === currentTeamId),
    [currentTeamId, teams],
  );

  const headerTitle = useMemo(() => {
    if (employee?.name) return `Chat with ${employee.name}`;
    if (team?.name) return `${team.name} Chat`;
    if (currentEmployeeId) return `Chat with ${currentEmployeeId}`;
    if (currentTeamId) return `Team ${currentTeamId} Chat`;
    return "Chat";
  }, [currentEmployeeId, currentTeamId, employee?.name, team?.name]);
  const storyPersona = useMemo<StoryChatPersona>(() => {
    const displayName =
      employee?.name ||
      team?.name ||
      (currentEmployeeId
        ? `Agent ${currentEmployeeId}`
        : currentTeamId
          ? `Team ${currentTeamId}`
          : "ShellCorp Agent");
    const subtitle =
      employee?.jobTitle?.trim() ||
      (currentEmployeeId
        ? "Direct Channel"
        : currentTeamId
          ? "Team Coordination"
          : "Experimental Story Chat");
    return {
      displayName,
      subtitle,
      avatarUrl: employee?.profileImageUrl?.trim() || undefined,
      emoji: employee?.isCEO ? "◆" : undefined,
      initials: getDisplayInitials(displayName),
      statusLabel: employee?.statusMessage?.trim() || employee?.status?.trim() || "Standing by",
      teamLabel: employee?.team?.trim() || team?.name?.trim() || undefined,
    };
  }, [
    currentEmployeeId,
    currentTeamId,
    employee?.isCEO,
    employee?.jobTitle,
    employee?.name,
    employee?.profileImageUrl,
    employee?.status,
    employee?.statusMessage,
    employee?.team,
    team?.name,
  ]);

  return {
    headerTitle,
    headerSubtitle:
      employee?.jobTitle ??
      (currentEmployeeId ? "Direct Message" : currentTeamId ? "Team Coordination" : undefined),
    currentEmployeeId: currentEmployeeId ? String(currentEmployeeId) : null,
    isEmployeeScopedChat: Boolean(currentEmployeeId),
    storyPersona,
  };
}
