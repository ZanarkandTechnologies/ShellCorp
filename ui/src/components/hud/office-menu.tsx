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
 */

import { useMemo, useCallback, useState, useEffect } from "react";
import { useQuery } from "convex/react";
import {
  Menu,
  Hammer,
  Home,
  MessageSquare,
  BookOpen,
  Settings,
  ShoppingBag,
  Users,
  Activity,
  ClipboardList,
  BriefcaseBusiness,
} from "lucide-react";
import { SpeedDial, type SpeedDialItem } from "@/components/ui/speed-dial";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/lib/app-store";
import { FurnitureShop } from "./furniture-shop";
import { useChatActions } from "@/features/chat-system/chat-store";
import { OrganizationPanel } from "./organization-panel";
import { api } from "../../../../convex/_generated/api";
import { isConvexEnabled } from "@/providers/convex-provider";
import { countReviewLaneTasks, resolveReviewBoardTasks } from "@/lib/review-board";

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

  const speedDialItems: SpeedDialItem[] = useMemo(
    () => [
      {
        id: "back-landing",
        icon: Home,
        label: "Back to Landing",
        onClick: () => navigate("/"),
        color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
      },
      {
        id: "organization",
        icon: Users,
        label: "Organization",
        onClick: () => setIsOrganizationOpen(true),
        color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
      },
      {
        id: "team-workspace",
        icon: Users,
        label: "Team Workspace",
        onClick: openGlobalTeamWorkspace,
        color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        buttonClassName:
          highlightedMenuActionId === "team-workspace"
            ? "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse"
            : undefined,
      },
      {
        id: "agent-session",
        icon: Activity,
        label: "Agent Session",
        onClick: () => setIsAgentSessionPanelOpen(true),
        color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
      },
      {
        id: "global-skills",
        icon: BookOpen,
        label: "Global Skills",
        onClick: () => {
          setSelectedSkillStudioSkillId(null);
          setSkillStudioFocusAgentId(null);
          setIsSkillsPanelOpen(true);
        },
        color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
      },
      {
        id: "ceo-chat",
        icon: MessageSquare,
        label: "CEO Chat",
        onClick: () => {
          void openEmployeeChat("employee-main", true);
        },
        color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
      },
      {
        id: "ceo-workbench",
        icon: BriefcaseBusiness,
        label: "CEO Workbench",
        onClick: () => {
          setCeoWorkbenchView("board");
          setIsCeoWorkbenchOpen(true);
        },
        color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
      },
      {
        id: "user-tasks",
        icon: ClipboardList,
        label: "Human Review",
        onClick: () => {
          setCeoWorkbenchView("review");
          setIsCeoWorkbenchOpen(true);
        },
        badge: userTaskCount > 0 ? userTaskCount : undefined,
        color:
          userTaskCount > 0
            ? "bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
            : "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
      },
      {
        id: "builder-mode",
        icon: Hammer,
        label: "Builder Mode",
        onClick: handleBuilderModeToggle,
        color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        disabled: isAnimatingCamera,
      },
      {
        id: "office-shop",
        icon: ShoppingBag,
        label: "Decoration",
        onClick: () => setIsFurnitureShopOpen(true),
        color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        buttonClassName:
          highlightedMenuActionId === "office-shop"
            ? "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse"
            : undefined,
      },
      {
        id: "settings",
        icon: Settings,
        label: "Settings",
        onClick: () => setIsSettingsModalOpen(true),
        color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
      },
    ],
    [
      navigate,
      openGlobalTeamWorkspace,
      highlightedMenuActionId,
      setIsAgentSessionPanelOpen,
      setIsSkillsPanelOpen,
      setSelectedSkillStudioSkillId,
      setSkillStudioFocusAgentId,
      openEmployeeChat,
      setIsCeoWorkbenchOpen,
      setCeoWorkbenchView,
      userTaskCount,
      handleBuilderModeToggle,
      isAnimatingCamera,
      setIsOrganizationOpen,
      setIsFurnitureShopOpen,
      setIsSettingsModalOpen,
    ],
  );

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
