"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import {
    Menu,
    Hammer,
    Home,
    MessageSquare,
    BookOpen,
    Settings,
    ShoppingBag,
    Users,
    ShieldCheck,
    Activity,
} from "lucide-react";
import { SpeedDial, type SpeedDialItem } from "@/components/ui/speed-dial";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/lib/app-store";
import { FurnitureShop } from "./furniture-shop";
import { ApprovalQueue } from "./approval-queue";
import { useChatActions } from "@/features/chat-system/chat-store";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { OrganizationPanel } from "./organization-panel";

interface SpeedDialProps {
    className?: string;
}

export function OfficeMenu({
    className,
}: SpeedDialProps) {
    const adapter = useOpenClawAdapter();
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

    const [isFurnitureShopOpen, setIsFurnitureShopOpen] = useState(false);
    const [isApprovalQueueOpen, setIsApprovalQueueOpen] = useState(false);
    const [isOrganizationOpen, setIsOrganizationOpen] = useState(false);
    const [approvalCount, setApprovalCount] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const poll = async () => {
            try {
                const approvals = await adapter.getPendingApprovals();
                if (!cancelled) setApprovalCount(approvals.length);
            } catch { /* ignore */ }
        };
        void poll();
        const timer = setInterval(() => void poll(), 10_000);
        return () => { cancelled = true; clearInterval(timer); };
    }, [adapter]);
    // Legacy team/agent manager dialogs were intentionally stripped from this UI flow.
    const canOpenAgentManager = false;
    const canOpenTeamManager = false;
    const { openEmployeeChat } = useChatActions();

    useEffect(() => {
        if (!placementMode.active) return;
        setIsFurnitureShopOpen(false);
        setIsApprovalQueueOpen(false);
        setIsOrganizationOpen(false);
    }, [placementMode.active]);

    // Handle builder mode toggle - let the scene handle animation
    const handleBuilderModeToggle = useCallback(() => {
        if (isAnimatingCamera) return; // Prevent clicks during animation

        setAnimatingCamera(true); // Start animation state
        setBuilderMode(!isBuilderMode); // This will trigger the animation in OfficeScene
    }, [isAnimatingCamera, isBuilderMode, setAnimatingCamera, setBuilderMode]);

    const openGlobalTeamWorkspace = useCallback(() => {
        setActiveTeamId(null);
        setSelectedTeamId(null);
        setKanbanFocusAgentId(null);
        setIsGlobalTeamPanelOpen(true);
    }, [setActiveTeamId, setIsGlobalTeamPanelOpen, setKanbanFocusAgentId, setSelectedTeamId]);

    const speedDialItems: SpeedDialItem[] = useMemo(() => [
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
            onClick: () => setIsSkillsPanelOpen(true),
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
            id: "approvals",
            icon: ShieldCheck,
            label: "Approvals",
            onClick: () => setIsApprovalQueueOpen(true),
            badge: approvalCount > 0 ? approvalCount : undefined,
            color: approvalCount > 0
                ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
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
            label: "Office Shop",
            onClick: () => setIsFurnitureShopOpen(true),
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
        openGlobalTeamWorkspace,
        setIsAgentSessionPanelOpen,
        setIsSkillsPanelOpen,
        openEmployeeChat,
        approvalCount,
        setIsApprovalQueueOpen,
        handleBuilderModeToggle,
        isAnimatingCamera,
        setIsOrganizationOpen,
        setIsFurnitureShopOpen,
        setIsSettingsModalOpen,
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
            <OrganizationPanel
                isOpen={isOrganizationOpen}
                onOpenChange={setIsOrganizationOpen}
                canOpenTeamManager={canOpenTeamManager}
                canOpenAgentManager={canOpenAgentManager}
            />
            {isFurnitureShopOpen ? <FurnitureShop isOpen={isFurnitureShopOpen} onOpenChange={setIsFurnitureShopOpen} /> : null}
            {isApprovalQueueOpen ? <ApprovalQueue isOpen={isApprovalQueueOpen} onOpenChange={setIsApprovalQueueOpen} /> : null}
        </>
    );
}

