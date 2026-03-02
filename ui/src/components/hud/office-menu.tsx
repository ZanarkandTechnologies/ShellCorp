"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import {
    Bell,
    Settings,
    Menu,
    Hammer,
    Home,
    Layers,
    MessageSquare,
    BookOpen,
    UserPlus,
    ShoppingBag,
    Users,
    UserSearch,
    Wrench,
} from "lucide-react";
import { SpeedDial, type SpeedDialItem } from "@/components/ui/speed-dial";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/lib/app-store";
import { api } from "@/convex/_generated/api";
import { UserTasksPanel } from "@/components/hud/user-tasks-panel";
import { AgentManager } from "./agent-manager";
import { FurnitureShop } from "./furniture-shop";
import { TeamManager } from "./team-manager";
import { TeamDirectory } from "./team-directory";
import { ToolManager } from "./tool-manager";
import { SkillManager } from "./skill-manager";

interface SpeedDialProps {
    className?: string;
}

export function OfficeMenu({
    className,
}: SpeedDialProps) {
    const navigate = useNavigate();
    // Use selectors to prevent unnecessary re-renders
    const isBuilderMode = useAppStore(state => state.isBuilderMode);
    const setBuilderMode = useAppStore(state => state.setBuilderMode);
    const isAnimatingCamera = useAppStore(state => state.isAnimatingCamera);
    const setAnimatingCamera = useAppStore(state => state.setAnimatingCamera);
    const setIsGlobalTeamPanelOpen = useAppStore(state => state.setIsGlobalTeamPanelOpen);
    const setIsAgentSessionPanelOpen = useAppStore(state => state.setIsAgentSessionPanelOpen);
    const setIsSkillsPanelOpen = useAppStore(state => state.setIsSkillsPanelOpen);
    const setActiveTeamId = useAppStore(state => state.setActiveTeamId);
    const setSelectedTeamId = useAppStore(state => state.setSelectedTeamId);
    const setKanbanFocusAgentId = useAppStore(state => state.setKanbanFocusAgentId);
    const setIsSettingsModalOpen = useAppStore(state => state.setIsSettingsModalOpen);
    const placementMode = useAppStore(state => state.placementMode);

    const [isUserTasksOpen, setIsUserTasksOpen] = useState(false);
    const [isAgentManagerOpen, setIsAgentManagerOpen] = useState(false);
    const [isFurnitureShopOpen, setIsFurnitureShopOpen] = useState(false);
    const [isTeamManagerOpen, setIsTeamManagerOpen] = useState(false);
    const [isTeamDirectoryOpen, setIsTeamDirectoryOpen] = useState(false);
    const [isToolManagerOpen, setIsToolManagerOpen] = useState(false);
    const [isSkillManagerOpen, setIsSkillManagerOpen] = useState(false);
    const apiRoot = api as unknown as {
        office_system?: {
            employees?: { createEmployee?: unknown };
            teams?: { updateTeam?: unknown };
        };
        agents_system?: {
            tools?: { toolConfigs?: { listToolConfigs?: unknown } };
        };
    };
    const canOpenAgentManager = Boolean(apiRoot.office_system?.employees?.createEmployee);
    const canOpenTeamManager = Boolean(apiRoot.office_system?.teams?.updateTeam);
    const canOpenToolManager = Boolean(apiRoot.agents_system?.tools?.toolConfigs?.listToolConfigs);

    useEffect(() => {
        if (!placementMode.active) return;
        setIsUserTasksOpen(false);
        setIsAgentManagerOpen(false);
        setIsFurnitureShopOpen(false);
        setIsTeamManagerOpen(false);
        setIsTeamDirectoryOpen(false);
        setIsToolManagerOpen(false);
        setIsSkillManagerOpen(false);
    }, [placementMode.active]);

    // Handle builder mode toggle - let the scene handle animation
    const handleBuilderModeToggle = useCallback(() => {
        if (isAnimatingCamera) return; // Prevent clicks during animation

        setAnimatingCamera(true); // Start animation state
        setBuilderMode(!isBuilderMode); // This will trigger the animation in OfficeScene
    }, [isAnimatingCamera, isBuilderMode, setAnimatingCamera, setBuilderMode]);

    const speedDialItems: SpeedDialItem[] = useMemo(() => [
        {
            id: "back-landing",
            icon: Home,
            label: "Back to Landing",
            onClick: () => navigate("/"),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
        {
            id: "builder-mode",
            icon: Hammer,
            label: "Builder Mode",
            onClick: handleBuilderModeToggle,
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
            disabled: isAnimatingCamera, // Disable during animation
        },
        {
            id: "user-tasks",
            icon: Bell,
            label: "User Tasks",
            onClick: () => setIsUserTasksOpen(true),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
        {
            id: "team-panel",
            icon: Layers,
            label: "Team Panel",
            onClick: () => {
                setActiveTeamId(null);
                setSelectedTeamId(null);
                setKanbanFocusAgentId(null);
                setIsGlobalTeamPanelOpen(true);
            },
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
        {
            id: "agent-session-panel",
            icon: MessageSquare,
            label: "Agent Session Panel",
            onClick: () => setIsAgentSessionPanelOpen(true),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
        {
            id: "recruit-agent",
            icon: UserPlus,
            label: "Recruit Agent",
            onClick: () => {
                if (!canOpenAgentManager) return;
                setIsAgentManagerOpen(true);
            },
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
            disabled: !canOpenAgentManager,
        },
        {
            id: "furniture-shop",
            icon: ShoppingBag,
            label: "Shop",
            onClick: () => setIsFurnitureShopOpen(true),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
        {
            id: "manage-teams",
            icon: Users,
            label: "Manage Teams",
            onClick: () => {
                if (!canOpenTeamManager) return;
                setIsTeamManagerOpen(true);
            },
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
            disabled: !canOpenTeamManager,
        },
        {
            id: "team-directory",
            icon: UserSearch,
            label: "Team Directory",
            onClick: () => setIsTeamDirectoryOpen(true),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
        {
            id: "manage-tools",
            icon: Wrench,
            label: "Manage Tools",
            onClick: () => {
                if (!canOpenToolManager) return;
                setIsToolManagerOpen(true);
            },
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
            disabled: !canOpenToolManager,
        },
        {
            id: "skills-panel",
            icon: BookOpen,
            label: "Skills Panel",
            onClick: () => setIsSkillsPanelOpen(true),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
        {
            id: "manage-skills",
            icon: BookOpen,
            label: "Manage Skills",
            onClick: () => setIsSkillManagerOpen(true),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
        {
            id: "settings",
            icon: Settings,
            label: "Settings",
            onClick: () => setIsSettingsModalOpen(true),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
    ], [
        navigate,
        isAnimatingCamera,
        handleBuilderModeToggle,
        setActiveTeamId,
        setIsAgentSessionPanelOpen,
        setIsGlobalTeamPanelOpen,
        setIsSettingsModalOpen,
        setIsSkillsPanelOpen,
        setKanbanFocusAgentId,
        setSelectedTeamId,
        canOpenAgentManager,
        canOpenTeamManager,
        canOpenToolManager,
    ]);

    return (
        <>
            <SpeedDial
                items={speedDialItems}
                position="top-left"
                direction="vertical"
                triggerIcon={Menu}
                triggerColor="bg-accent hover:bg-accent/90 text-accent-foreground"
                className={className}
            />
            {isUserTasksOpen ? <UserTasksPanel isOpen={isUserTasksOpen} onOpenChange={setIsUserTasksOpen} /> : null}
            {isAgentManagerOpen ? <AgentManager isOpen={isAgentManagerOpen} onOpenChange={setIsAgentManagerOpen} /> : null}
            {isFurnitureShopOpen ? <FurnitureShop isOpen={isFurnitureShopOpen} onOpenChange={setIsFurnitureShopOpen} /> : null}
            {isTeamManagerOpen ? <TeamManager isOpen={isTeamManagerOpen} onOpenChange={setIsTeamManagerOpen} /> : null}
            {isTeamDirectoryOpen ? <TeamDirectory isOpen={isTeamDirectoryOpen} onOpenChange={setIsTeamDirectoryOpen} /> : null}
            {isToolManagerOpen ? <ToolManager isOpen={isToolManagerOpen} onOpenChange={setIsToolManagerOpen} /> : null}
            {isSkillManagerOpen ? <SkillManager isOpen={isSkillManagerOpen} onOpenChange={setIsSkillManagerOpen} /> : null}
        </>
    );
}

