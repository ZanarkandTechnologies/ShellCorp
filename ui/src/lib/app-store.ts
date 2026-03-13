"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import type { OfficeId } from "@/lib/types";
import type { TeamData } from "@/lib/types";
import type { OfficeOnboardingStep } from "@/lib/office-onboarding";

type PlacementMode = {
  active: boolean;
  type: string | null;
  data: Record<string, unknown> | null;
};

export type BuilderTool = "paint-floor" | "remove-floor" | null;

type ObjectPanelAspectRatio = "wide" | "square" | "tall";
export type CeoWorkbenchView = "board" | "review";

export type ActiveObjectPanelState = {
  objectId: OfficeId<"officeObjects">;
  title: string;
  url: string;
  displayName?: string;
  aspectRatio?: ObjectPanelAspectRatio;
  openedAtMs: number;
};

function areActiveObjectPanelsEqual(
  current: ActiveObjectPanelState | null,
  next: ActiveObjectPanelState | null,
): boolean {
  if (current === next) return true;
  if (!current || !next) return false;
  return (
    current.objectId === next.objectId &&
    current.title === next.title &&
    current.url === next.url &&
    current.displayName === next.displayName &&
    current.aspectRatio === next.aspectRatio &&
    current.openedAtMs === next.openedAtMs
  );
}

interface AppState {
  isChatModalOpen: boolean;
  setIsChatModalOpen: (isOpen: boolean) => void;
  isUserTasksModalOpen: boolean;
  setIsUserTasksModalOpen: (isOpen: boolean) => void;
  isCeoWorkbenchOpen: boolean;
  setIsCeoWorkbenchOpen: (isOpen: boolean) => void;
  ceoWorkbenchView: CeoWorkbenchView;
  setCeoWorkbenchView: (view: CeoWorkbenchView) => void;
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
  activeBuilderTool: BuilderTool;
  setActiveBuilderTool: (tool: BuilderTool) => void;
  isDragging: boolean;
  setIsDragging: (enabled: boolean) => void;
  isAnimatingCamera: boolean;
  setAnimatingCamera: (enabled: boolean) => void;
  placementMode: PlacementMode;
  setPlacementMode: (mode: PlacementMode) => void;
  selectedObjectId: string | null;
  setSelectedObjectId: (id: string | null) => void;
  activeObjectConfigId: OfficeId<"officeObjects"> | null;
  setActiveObjectConfigId: (id: OfficeId<"officeObjects"> | null) => void;
  activeObjectTransformId: OfficeId<"officeObjects"> | null;
  setActiveObjectTransformId: (id: OfficeId<"officeObjects"> | null) => void;
  activeObjectPanel: ActiveObjectPanelState | null;
  setActiveObjectPanel: (panel: ActiveObjectPanelState | null) => void;
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
  selectedSkillStudioSkillId: string | null;
  setSelectedSkillStudioSkillId: (skillId: string | null) => void;
  skillStudioFocusAgentId: string | null;
  setSkillStudioFocusAgentId: (agentId: string | null) => void;
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
  isFurnitureShopOpen: boolean;
  setIsFurnitureShopOpen: (isOpen: boolean) => void;
  isOfficeOnboardingVisible: boolean;
  setIsOfficeOnboardingVisible: (isVisible: boolean) => void;
  officeOnboardingStep: OfficeOnboardingStep | null;
  setOfficeOnboardingStep: (step: OfficeOnboardingStep | null) => void;
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set) => ({
    isChatModalOpen: false,
    setIsChatModalOpen: (isOpen) => set({ isChatModalOpen: isOpen }),
    isUserTasksModalOpen: false,
    setIsUserTasksModalOpen: (isOpen) => set({ isUserTasksModalOpen: isOpen }),
    isCeoWorkbenchOpen: false,
    setIsCeoWorkbenchOpen: (isOpen) => set({ isCeoWorkbenchOpen: isOpen }),
    ceoWorkbenchView: "board",
    setCeoWorkbenchView: (view) => set({ ceoWorkbenchView: view }),
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
    activeBuilderTool: null,
    setActiveBuilderTool: (tool) => set({ activeBuilderTool: tool }),
    isDragging: false,
    setIsDragging: (enabled) => set({ isDragging: enabled }),
    isAnimatingCamera: false,
    setAnimatingCamera: (enabled) => set({ isAnimatingCamera: enabled }),
    placementMode: { active: false, type: null, data: null },
    setPlacementMode: (mode) => set({ placementMode: mode }),
    selectedObjectId: null,
    // Keep no-op writes from fanning out through the whole scene tree.
    setSelectedObjectId: (id) =>
      set((state) => (state.selectedObjectId === id ? state : { selectedObjectId: id })),
    activeObjectConfigId: null,
    setActiveObjectConfigId: (id) =>
      set((state) => (state.activeObjectConfigId === id ? state : { activeObjectConfigId: id })),
    activeObjectTransformId: null,
    setActiveObjectTransformId: (id) =>
      set((state) => (state.activeObjectTransformId === id ? state : { activeObjectTransformId: id })),
    activeObjectPanel: null,
    // Modal payload is compared structurally so repeated opens of the same state do not trigger extra work.
    setActiveObjectPanel: (panel) =>
      set((state) =>
        areActiveObjectPanelsEqual(state.activeObjectPanel, panel)
          ? state
          : { activeObjectPanel: panel },
      ),
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
    selectedSkillStudioSkillId: null,
    setSelectedSkillStudioSkillId: (skillId) => set({ selectedSkillStudioSkillId: skillId }),
    skillStudioFocusAgentId: null,
    setSkillStudioFocusAgentId: (agentId) => set({ skillStudioFocusAgentId: agentId }),
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
    isFurnitureShopOpen: false,
    setIsFurnitureShopOpen: (isOpen) => set({ isFurnitureShopOpen: isOpen }),
    isOfficeOnboardingVisible: false,
    setIsOfficeOnboardingVisible: (isVisible) => set({ isOfficeOnboardingVisible: isVisible }),
    officeOnboardingStep: null,
    setOfficeOnboardingStep: (step) => set({ officeOnboardingStep: step }),
  })),
);

if (import.meta.env.DEV && typeof window !== "undefined") {
  // Exposed only in dev so QA scripts can poke the live store instance without importing a second module copy.
  (window as typeof window & { __SHELLCORP_APP_STORE?: typeof useAppStore }).__SHELLCORP_APP_STORE =
    useAppStore;
}
