"use client";

/**
 * OFFICE MENU
 * ===========
 * Global office launcher for top-level HUD surfaces.
 *
 * KEY CONCEPTS:
 * - Keeps the operator menu focused on current ShellCorp workflows.
 * - Routes board-native human review through the shared CEO Workbench review view.
 *
 * USAGE:
 * - Mounted from `office-simulation.tsx`.
 *
 * MEMORY REFERENCES:
 * - MEM-0155
 * - MEM-0192
 * - MEM-0220
 */

import { useMemo, useCallback, useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { Menu } from "lucide-react";
import { SpeedDial, type SpeedDialItem } from "@/components/ui/speed-dial";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/lib/app-store";
import { FurnitureShop } from "./furniture-shop";
import { useChatActions } from "@/features/chat-system/chat-store";
import { OrganizationPanel } from "./organization-panel";
import { api } from "../../../../convex/_generated/api";
import { isConvexEnabled } from "@/providers/convex-provider";
import { countReviewLaneTasks, resolveReviewBoardTasks } from "@/lib/review-board";
import { OfficeCommandPalette } from "./office-command-palette";
import {
  OFFICE_COMMAND_PALETTE_SHORTCUT,
  createOfficePanelActions,
  eventMatchesShortcut,
  isEditableEventTarget,
  type OfficePanelAction,
  type OfficePanelActionId,
} from "./office-panel-registry";

interface SpeedDialProps {
  className?: string;
}

export function OfficeMenu({ className }: SpeedDialProps) {
  const convexEnabled = isConvexEnabled();
  const navigate = useNavigate();
  // Use selectors to prevent unnecessary re-renders
  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const setBuilderMode = useAppStore((state) => state.setBuilderMode);
  const isAnimatingCamera = useAppStore((state) => state.isAnimatingCamera);
  const setIsGlobalTeamPanelOpen = useAppStore((state) => state.setIsGlobalTeamPanelOpen);
  const setIsAgentSessionPanelOpen = useAppStore((state) => state.setIsAgentSessionPanelOpen);
  const setIsSkillsPanelOpen = useAppStore((state) => state.setIsSkillsPanelOpen);
  const setSelectedSkillStudioSkillId = useAppStore((state) => state.setSelectedSkillStudioSkillId);
  const setSkillStudioFocusAgentId = useAppStore((state) => state.setSkillStudioFocusAgentId);
  const setActiveTeamId = useAppStore((state) => state.setActiveTeamId);
  const setSelectedTeamId = useAppStore((state) => state.setSelectedTeamId);
  const setKanbanFocusAgentId = useAppStore((state) => state.setKanbanFocusAgentId);
  const setIsSettingsModalOpen = useAppStore((state) => state.setIsSettingsModalOpen);
  const placementMode = useAppStore((state) => state.placementMode);
  const setIsCeoWorkbenchOpen = useAppStore((state) => state.setIsCeoWorkbenchOpen);
  const setCeoWorkbenchView = useAppStore((state) => state.setCeoWorkbenchView);
  const isFurnitureShopOpen = useAppStore((state) => state.isFurnitureShopOpen);
  const setIsFurnitureShopOpen = useAppStore((state) => state.setIsFurnitureShopOpen);
  const isOfficeOnboardingVisible = useAppStore((state) => state.isOfficeOnboardingVisible);
  const officeOnboardingStep = useAppStore((state) => state.officeOnboardingStep);

  const [isOrganizationOpen, setIsOrganizationOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const companyBoard = useQuery(
    api.board.getCompanyBoardTasks,
    convexEnabled ? {} : "skip",
  );
  const userTaskCount = useMemo(() => {
    const { tasks } = resolveReviewBoardTasks({
      convexEnabled,
      hasLoaded: companyBoard !== undefined,
      rows: companyBoard?.tasks,
    });
    return countReviewLaneTasks(tasks);
  }, [companyBoard, convexEnabled]);
  // Legacy team/agent manager dialogs were intentionally stripped from this UI flow.
  const canOpenAgentManager = false;
  const canOpenTeamManager = false;
  const { openEmployeeChat } = useChatActions();

  useEffect(() => {
    if (!placementMode.active) return;
    setIsFurnitureShopOpen(false);
    setIsOrganizationOpen(false);
  }, [placementMode.active]);

  // Handle builder mode toggle - let the scene handle animation
  const handleBuilderModeToggle = useCallback(() => {
    if (isAnimatingCamera) return; // Prevent clicks during animation

    setBuilderMode(!isBuilderMode); // This will trigger the animation in OfficeScene
  }, [isAnimatingCamera, isBuilderMode, setBuilderMode]);

  const openGlobalTeamWorkspace = useCallback(() => {
    setActiveTeamId(null);
    setSelectedTeamId(null);
    setKanbanFocusAgentId(null);
    setIsGlobalTeamPanelOpen(true);
  }, [setActiveTeamId, setIsGlobalTeamPanelOpen, setKanbanFocusAgentId, setSelectedTeamId]);

  const shouldGuideMenu =
    isOfficeOnboardingVisible &&
    (officeOnboardingStep === "open-shop" || officeOnboardingStep === "open-team");
  const highlightedMenuActionId =
    officeOnboardingStep === "open-shop"
      ? "office-shop"
      : officeOnboardingStep === "open-team"
        ? "team-workspace"
        : null;

  const officeActions = useMemo(
    () =>
      createOfficePanelActions({
        highlightedMenuActionId,
        isAnimatingCamera,
        isBuilderMode,
        navigateToLanding: () => navigate("/"),
        openAgentSession: () => setIsAgentSessionPanelOpen(true),
        openCeoChat: () => {
          void openEmployeeChat("employee-main", true);
        },
        openCeoWorkbench: (view) => {
          setCeoWorkbenchView(view);
          setIsCeoWorkbenchOpen(true);
        },
        openDecoration: () => setIsFurnitureShopOpen(true),
        openGlobalSkills: () => {
          setSelectedSkillStudioSkillId(null);
          setSkillStudioFocusAgentId(null);
          setIsSkillsPanelOpen(true);
        },
        openGlobalTeamWorkspace,
        openOrganization: () => setIsOrganizationOpen(true),
        openSettings: () => setIsSettingsModalOpen(true),
        toggleBuilderMode: handleBuilderModeToggle,
        userTaskCount,
      }),
    [
      highlightedMenuActionId,
      isAnimatingCamera,
      isBuilderMode,
      navigate,
      setIsAgentSessionPanelOpen,
      openEmployeeChat,
      setCeoWorkbenchView,
      setIsCeoWorkbenchOpen,
      setIsFurnitureShopOpen,
      setSelectedSkillStudioSkillId,
      setSkillStudioFocusAgentId,
      setIsSkillsPanelOpen,
      openGlobalTeamWorkspace,
      setIsSettingsModalOpen,
      handleBuilderModeToggle,
      userTaskCount,
    ],
  );

  const speedDialItems: SpeedDialItem[] = useMemo(
    () =>
      officeActions
        .filter((action) => action.showInMenu !== false)
        .map((action) => ({
          id: action.id,
          icon: action.icon,
          label: action.label,
          onClick: action.perform,
          badge: action.badge,
          color: action.color,
          disabled: action.disabled,
          buttonClassName: action.buttonClassName,
        })),
    [officeActions],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || isEditableEventTarget(event.target)) {
        return;
      }

      if (eventMatchesShortcut(event, OFFICE_COMMAND_PALETTE_SHORTCUT)) {
        event.preventDefault();
        setIsCommandPaletteOpen((previous) => !previous);
        return;
      }

      const matchingAction = officeActions.find(
        (action) => action.shortcut && eventMatchesShortcut(event, action.shortcut),
      );
      if (!matchingAction || matchingAction.disabled) {
        return;
      }

      event.preventDefault();
      matchingAction.perform();
      setIsCommandPaletteOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [officeActions]);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") {
      return;
    }

    const qaWindow = window as typeof window & {
      __SHELLCORP_QA__?: {
        listPanels: () => Array<{
          description: string;
          id: OfficePanelActionId;
          label: string;
          shortcut: string | null;
        }>;
        openPanel: (id: OfficePanelActionId) => boolean;
        runCommand: (id: OfficePanelActionId) => boolean;
      };
    };

    const runAction = (id: OfficePanelActionId, allowedGroups: OfficePanelAction["group"][]) => {
      const action = officeActions.find(
        (candidate) => candidate.id === id && allowedGroups.includes(candidate.group),
      );
      if (!action || action.disabled) {
        return false;
      }
      action.perform();
      setIsCommandPaletteOpen(false);
      return true;
    };

    qaWindow.__SHELLCORP_QA__ = {
      listPanels: () =>
        officeActions
          .filter((action) => action.group === "panel")
          .map((action) => ({
            id: action.id,
            label: action.label,
            description: action.description,
            shortcut: action.shortcut?.label ?? null,
          }))
          .sort((left, right) => left.label.localeCompare(right.label)),
      openPanel: (id) => runAction(id, ["panel"]),
      runCommand: (id) => runAction(id, ["action", "navigation", "panel"]),
    };

    return () => {
      delete qaWindow.__SHELLCORP_QA__;
    };
  }, [officeActions]);

  return (
    <>
      <SpeedDial
        items={speedDialItems}
        position="top-left"
        direction="vertical"
        triggerIcon={Menu}
        triggerColor="bg-accent hover:bg-accent/90 text-accent-foreground"
        triggerClassName={
          shouldGuideMenu
            ? "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse"
            : undefined
        }
        forceOpen={shouldGuideMenu}
        className={className}
      />
      <OfficeCommandPalette
        actions={officeActions}
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
      />
      <OrganizationPanel
        isOpen={isOrganizationOpen}
        onOpenChange={setIsOrganizationOpen}
        canOpenTeamManager={canOpenTeamManager}
        canOpenAgentManager={canOpenAgentManager}
      />
      {isFurnitureShopOpen ? (
        <FurnitureShop isOpen={isFurnitureShopOpen} onOpenChange={setIsFurnitureShopOpen} />
      ) : null}
    </>
  );
}
