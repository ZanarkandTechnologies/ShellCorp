"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
    Settings,
    Bell,
    User,
    Building2,
    TrendingUp,
    Menu,
    Hammer,
    Users,
    ShoppingBag,
    UserPlus,
    Wrench,
    BookOpen,
    UserSearch,
    NotebookPen
} from "lucide-react";
import { SpeedDial, type SpeedDialItem } from "@/components/ui/speed-dial";
import SettingsDialog from "@/components/dialogs/settings-dialog";
import { useAppStore } from "@/lib/app-store";
import { TeamManager } from "./team-manager";
import { FurnitureShop } from "./furniture-shop";
import { AgentManager } from "./agent-manager";
import { ToolManager } from "./tool-manager";
import { SkillManager } from "./skill-manager";
import { TeamDirectory } from "./team-directory";
import { BenchmarksModal } from "@/features/self-improvement-system/components/benchmarks-modal";

interface SpeedDialProps {
    onUserTasksClick: () => void;
    pendingTasksCount?: number;
    className?: string;
}

export function OfficeMenu({
    onUserTasksClick,
    pendingTasksCount = 0,
    className,
}: SpeedDialProps) {
    // Use selectors to prevent unnecessary re-renders
    const isBuilderMode = useAppStore(state => state.isBuilderMode);
    const setBuilderMode = useAppStore(state => state.setBuilderMode);
    const isAnimatingCamera = useAppStore(state => state.isAnimatingCamera);
    const setAnimatingCamera = useAppStore(state => state.setAnimatingCamera);
    const placementMode = useAppStore(state => state.placementMode);

    const [isTeamManagerOpen, setIsTeamManagerOpen] = useState(false);
    const [isShopOpen, setIsShopOpen] = useState(false);
    const [isAgentManagerOpen, setIsAgentManagerOpen] = useState(false);
    const [isToolManagerOpen, setIsToolManagerOpen] = useState(false);
    const [isSkillManagerOpen, setIsSkillManagerOpen] = useState(false);
    const [isTeamDirectoryOpen, setIsTeamDirectoryOpen] = useState(false);
    const [isBenchmarksModalOpen, setIsBenchmarksModalOpen] = useState(false);

    // Close all modals when placement mode becomes active
    useEffect(() => {
        if (placementMode.active) {
            setIsTeamManagerOpen(false);
            setIsShopOpen(false);
            setIsAgentManagerOpen(false);
            setIsToolManagerOpen(false);
            setIsSkillManagerOpen(false);
            setIsTeamDirectoryOpen(false);
            setIsBenchmarksModalOpen(false);
        }
    }, [placementMode.active]);

    // Handle builder mode toggle - let the scene handle animation
    const handleBuilderModeToggle = useCallback(() => {
        if (isAnimatingCamera) return; // Prevent clicks during animation

        setAnimatingCamera(true); // Start animation state
        setBuilderMode(!isBuilderMode); // This will trigger the animation in OfficeScene
    }, [isAnimatingCamera, isBuilderMode, setAnimatingCamera, setBuilderMode]);

    const speedDialItems: SpeedDialItem[] = useMemo(() => [
        {
            id: "user-tasks",
            icon: Bell,
            label: "User Tasks",
            onClick: onUserTasksClick,
            badge: pendingTasksCount > 0 ? pendingTasksCount : undefined,
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
            id: "recruit",
            icon: UserPlus,
            label: "Recruit Agent",
            onClick: () => setIsAgentManagerOpen(true),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
        {
            id: "shop",
            icon: ShoppingBag,
            label: "Shop",
            onClick: () => setIsShopOpen(true),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
        {
            id: "teams",
            icon: Users,
            label: "Manage Teams",
            onClick: () => setIsTeamManagerOpen(true),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
        {
            id: "directory",
            icon: UserSearch,
            label: "Team Directory",
            onClick: () => setIsTeamDirectoryOpen(true),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
        {
            id: "tools",
            icon: Wrench,
            label: "Manage Tools",
            onClick: () => setIsToolManagerOpen(true),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
        {
            id: "skills",
            icon: BookOpen,
            label: "Manage Skills",
            onClick: () => setIsSkillManagerOpen(true),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
        {
            id: "benchmarks",
            icon: NotebookPen,
            label: "Benchmarks",
            onClick: () => setIsBenchmarksModalOpen(true),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
        {
            id: "settings",
            icon: Settings,
            label: "Settings",
            onClick: () => { },
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
            component: (
                <SettingsDialog
                    trigger={
                        <button className="h-12 w-12 rounded-full shadow-lg transition-all duration-200 bg-secondary hover:bg-secondary/80 text-secondary-foreground flex items-center justify-center">
                            <Settings className="h-5 w-5" />
                        </button>
                    }
                />
            ),
        },
        {
            id: "profile",
            icon: User,
            label: "Profile",
            onClick: () => console.log("Profile clicked"),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
            disabled: true, // Placeholder for now
        },
        {
            id: "company",
            icon: Building2,
            label: "Company",
            onClick: () => console.log("Company clicked"),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
            disabled: true, // Placeholder for now
        },
        {
            id: "analytics",
            icon: TrendingUp,
            label: "Analytics",
            onClick: () => console.log("Analytics clicked"),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
            disabled: true, // Placeholder for now
        },
    ], [onUserTasksClick, pendingTasksCount, isAnimatingCamera, handleBuilderModeToggle]);

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
            <TeamManager isOpen={isTeamManagerOpen} onOpenChange={setIsTeamManagerOpen} />
            <FurnitureShop isOpen={isShopOpen} onOpenChange={setIsShopOpen} />
            <AgentManager isOpen={isAgentManagerOpen} onOpenChange={setIsAgentManagerOpen} />
            <ToolManager isOpen={isToolManagerOpen} onOpenChange={setIsToolManagerOpen} />
            <SkillManager isOpen={isSkillManagerOpen} onOpenChange={setIsSkillManagerOpen} />
            <TeamDirectory isOpen={isTeamDirectoryOpen} onOpenChange={setIsTeamDirectoryOpen} />
            <BenchmarksModal isOpen={isBenchmarksModalOpen} onOpenChange={setIsBenchmarksModalOpen} />
        </>
    );
}

