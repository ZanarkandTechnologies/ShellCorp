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
  isTeamPanelOpen: boolean;
  setIsTeamPanelOpen: (isOpen: boolean) => void;
  activeTeamId: Id<"teams"> | null;
  setActiveTeamId: (id: Id<"teams"> | null) => void;
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
    isTeamPanelOpen: false,
    setIsTeamPanelOpen: (isOpen) => set({ isTeamPanelOpen: isOpen }),
    activeTeamId: null,
    setActiveTeamId: (id) => set({ activeTeamId: id }),
  })),
);
