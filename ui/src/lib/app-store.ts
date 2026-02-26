"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import type { OfficeId } from "@/lib/types";
import type { TeamData } from "@/lib/types";

type PlacementMode = {
  active: boolean;
  type: string | null;
  data: Record<string, unknown> | null;
};

interface AppState {
  isChatModalOpen: boolean;
  setIsChatModalOpen: (isOpen: boolean) => void;
  isUserTasksModalOpen: boolean;
  setIsUserTasksModalOpen: (isOpen: boolean) => void;
  isTeamOptionsDialogOpen: boolean;
  setIsTeamOptionsDialogOpen: (isOpen: boolean) => void;
  activeTeamForOptions: TeamData | null;
  setActiveTeamForOptions: (team: TeamData | null) => void;
  activeChatParticipant: Record<string, unknown> | null;
  setActiveChatParticipant: (participant: Record<string, unknown> | null) => void;
  debugMode: boolean;
  setDebugMode: (enabled: boolean) => void;
  isBuilderMode: boolean;
  setBuilderMode: (enabled: boolean) => void;
  isDragging: boolean;
  setIsDragging: (enabled: boolean) => void;
  isAnimatingCamera: boolean;
  setAnimatingCamera: (enabled: boolean) => void;
  placementMode: PlacementMode;
  setPlacementMode: (mode: PlacementMode) => void;
  selectedObjectId: string | null;
  setSelectedObjectId: (id: string | null) => void;
  manageAgentEmployeeId: OfficeId<"employees"> | null;
  setManageAgentEmployeeId: (id: OfficeId<"employees"> | null) => void;
  viewComputerEmployeeId: OfficeId<"employees"> | null;
  viewComputerInitialProjectId: string | null;
  setViewComputerEmployeeId: (id: OfficeId<"employees"> | null, projectId?: string | null) => void;
  taskStatusEmployeeId: OfficeId<"employees"> | null;
  setTaskStatusEmployeeId: (id: OfficeId<"employees"> | null) => void;
  highlightedEmployeeIds: Set<OfficeId<"employees">>;
  setHighlightedEmployeeIds: (
    ids: Array<OfficeId<"employees">> | Set<OfficeId<"employees">> | null,
  ) => void;
  trainingEmployeeId: OfficeId<"employees"> | null;
  setTrainingEmployeeId: (id: OfficeId<"employees"> | null) => void;
  memoryPanelEmployeeId: OfficeId<"employees"> | null;
  setMemoryPanelEmployeeId: (id: OfficeId<"employees"> | null) => void;
  isTeamPanelOpen: boolean;
  setIsTeamPanelOpen: (isOpen: boolean) => void;
  isGlobalTeamPanelOpen: boolean;
  setIsGlobalTeamPanelOpen: (isOpen: boolean) => void;
  isAgentSessionPanelOpen: boolean;
  setIsAgentSessionPanelOpen: (isOpen: boolean) => void;
  isSkillsPanelOpen: boolean;
  setIsSkillsPanelOpen: (isOpen: boolean) => void;
  activeTeamId: string | null;
  setActiveTeamId: (id: string | null) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string | null) => void;
  selectedTeamId: string | null;
  setSelectedTeamId: (teamId: string | null) => void;
  kanbanFocusAgentId: string | null;
  setKanbanFocusAgentId: (agentId: string | null) => void;
  selectedAgentId: string | null;
  setSelectedAgentId: (agentId: string | null) => void;
  selectedSessionKey: string | null;
  setSelectedSessionKey: (sessionKey: string | null) => void;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set) => ({
    isChatModalOpen: false,
    setIsChatModalOpen: (isOpen) => set({ isChatModalOpen: isOpen }),
    isUserTasksModalOpen: false,
    setIsUserTasksModalOpen: (isOpen) => set({ isUserTasksModalOpen: isOpen }),
    isTeamOptionsDialogOpen: false,
    setIsTeamOptionsDialogOpen: (isOpen) => set({ isTeamOptionsDialogOpen: isOpen }),
    activeTeamForOptions: null,
    setActiveTeamForOptions: (team) => set({ activeTeamForOptions: team }),
    activeChatParticipant: null,
    setActiveChatParticipant: (participant) => set({ activeChatParticipant: participant }),
    debugMode: false,
    setDebugMode: (enabled) => set({ debugMode: enabled }),
    isBuilderMode: false,
    setBuilderMode: (enabled) => set({ isBuilderMode: enabled }),
    isDragging: false,
    setIsDragging: (enabled) => set({ isDragging: enabled }),
    isAnimatingCamera: false,
    setAnimatingCamera: (enabled) => set({ isAnimatingCamera: enabled }),
    placementMode: { active: false, type: null, data: null },
    setPlacementMode: (mode) => set({ placementMode: mode }),
    selectedObjectId: null,
    setSelectedObjectId: (id) => set({ selectedObjectId: id }),
    manageAgentEmployeeId: null,
    setManageAgentEmployeeId: (id) => set({ manageAgentEmployeeId: id }),
    viewComputerEmployeeId: null,
    viewComputerInitialProjectId: null,
    setViewComputerEmployeeId: (id, projectId) =>
      set({ viewComputerEmployeeId: id, viewComputerInitialProjectId: projectId ?? null }),
    taskStatusEmployeeId: null,
    setTaskStatusEmployeeId: (id) => set({ taskStatusEmployeeId: id }),
    highlightedEmployeeIds: new Set<OfficeId<"employees">>(),
    setHighlightedEmployeeIds: (ids) =>
      set({
        highlightedEmployeeIds:
          ids == null ? new Set<OfficeId<"employees">>() : ids instanceof Set ? ids : new Set(ids),
      }),
    trainingEmployeeId: null,
    setTrainingEmployeeId: (id) => set({ trainingEmployeeId: id }),
    memoryPanelEmployeeId: null,
    setMemoryPanelEmployeeId: (id) => set({ memoryPanelEmployeeId: id }),
    isTeamPanelOpen: false,
    setIsTeamPanelOpen: (isOpen) => set({ isTeamPanelOpen: isOpen }),
    isGlobalTeamPanelOpen: false,
    setIsGlobalTeamPanelOpen: (isOpen) => set({ isGlobalTeamPanelOpen: isOpen }),
    isAgentSessionPanelOpen: false,
    setIsAgentSessionPanelOpen: (isOpen) => set({ isAgentSessionPanelOpen: isOpen }),
    isSkillsPanelOpen: false,
    setIsSkillsPanelOpen: (isOpen) => set({ isSkillsPanelOpen: isOpen }),
    activeTeamId: null,
    setActiveTeamId: (id) => set({ activeTeamId: id }),
    selectedProjectId: null,
    setSelectedProjectId: (projectId) => set({ selectedProjectId: projectId }),
    selectedTeamId: null,
    setSelectedTeamId: (teamId) => set({ selectedTeamId: teamId }),
    kanbanFocusAgentId: null,
    setKanbanFocusAgentId: (agentId) => set({ kanbanFocusAgentId: agentId }),
    selectedAgentId: null,
    setSelectedAgentId: (agentId) => set({ selectedAgentId: agentId }),
    selectedSessionKey: null,
    setSelectedSessionKey: (sessionKey) => set({ selectedSessionKey: sessionKey }),
    isSettingsModalOpen: false,
    setIsSettingsModalOpen: (isOpen) => set({ isSettingsModalOpen: isOpen }),
  })),
);
