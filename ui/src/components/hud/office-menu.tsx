"use client";

import { useMemo, useCallback } from "react";
import {
    Settings,
    Menu,
    Hammer,
    Home,
    Layers,
    MessageSquare,
    BookOpen,
} from "lucide-react";
import { SpeedDial, type SpeedDialItem } from "@/components/ui/speed-dial";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/lib/app-store";

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
            id: "skills-panel",
            icon: BookOpen,
            label: "Skills Panel",
            onClick: () => setIsSkillsPanelOpen(true),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
        {
            id: "settings",
            icon: Settings,
            label: "Settings",
            onClick: () => setIsSettingsModalOpen(true),
            color: "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
        },
    ], [navigate, isAnimatingCamera, handleBuilderModeToggle, setActiveTeamId, setIsAgentSessionPanelOpen, setIsGlobalTeamPanelOpen, setIsSettingsModalOpen, setIsSkillsPanelOpen, setKanbanFocusAgentId, setSelectedTeamId]);

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
        </>
    );
}

