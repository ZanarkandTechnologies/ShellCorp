/**
 * OFFICE SCENE INTERACTIONS
 * =========================
 * Centralized click handlers for office scene entities and background resets.
 *
 * KEY CONCEPTS:
 * - Scene interaction routing should live in one hook instead of being recreated inline.
 * - Placement mode remains the guardrail for scene click side-effects.
 *
 * USAGE:
 * - Call from `scene-contents.tsx` and pass the returned callbacks to scene entities.
 *
 * MEMORY REFERENCES:
 * - MEM-0108
 * - MEM-0143
 * - MEM-0153
 */

import { useCallback } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useAppStore } from '@/lib/app-store';
import { useChatActions } from '@/features/chat-system';
import type { EmployeeData, TeamData } from '@/lib/types';

export function useOfficeSceneInteractions(params: {
    employees: EmployeeData[];
}): {
    handleBackgroundClick: (event: ThreeEvent<MouseEvent>) => void;
    handleEmployeeClick: (employeeId: EmployeeData['_id']) => Promise<void>;
    handleTeamClick: (team: TeamData) => Promise<void>;
    handleCeoDeskClick: (event: ThreeEvent<MouseEvent>) => void;
} {
    const { employees } = params;
    const { openEmployeeChat } = useChatActions();

    const setActiveChatParticipant = useAppStore((state) => state.setActiveChatParticipant);
    const setIsTeamPanelOpen = useAppStore((state) => state.setIsTeamPanelOpen);
    const setActiveTeamId = useAppStore((state) => state.setActiveTeamId);
    const setSelectedTeamId = useAppStore((state) => state.setSelectedTeamId);
    const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
    const setKanbanFocusAgentId = useAppStore((state) => state.setKanbanFocusAgentId);
    const setIsCeoWorkbenchOpen = useAppStore((state) => state.setIsCeoWorkbenchOpen);
    const placementMode = useAppStore((state) => state.placementMode);
    const isDragging = useAppStore((state) => state.isDragging);
    const setSelectedObjectId = useAppStore((state) => state.setSelectedObjectId);

    const handleEmployeeClick = useCallback(
        async (employeeId: EmployeeData['_id']) => {
            const employee = employees.find((entry) => entry._id === employeeId);
            if (!employee) return;
            if (useAppStore.getState().placementMode.active) return;
            if (!employee.companyId) return;

            setActiveChatParticipant({
                type: 'employee',
                companyId: employee.companyId,
                employeeId: employee._id,
                teamId: employee.teamId,
                builtInRole: employee.builtInRole,
            });
            await openEmployeeChat(employee._id, true);
        },
        [employees, openEmployeeChat, setActiveChatParticipant],
    );

    const handleTeamClick = useCallback(
        async (team: TeamData) => {
            if (useAppStore.getState().placementMode.active) return;

            if (!team.companyId) {
                console.error('Team has no company:', team);
                return;
            }

            setActiveTeamId(team._id);
            setSelectedTeamId(team._id);
            if (String(team._id).startsWith('team-')) {
                setSelectedProjectId(String(team._id).replace(/^team-/, ''));
            }
            setKanbanFocusAgentId(null);
            setIsTeamPanelOpen(true);
        },
        [
            setActiveTeamId,
            setIsTeamPanelOpen,
            setKanbanFocusAgentId,
            setSelectedProjectId,
            setSelectedTeamId,
        ],
    );

    const handleBackgroundClick = useCallback(
        (event: ThreeEvent<MouseEvent>) => {
            if (!placementMode.active && !isDragging) {
                event.stopPropagation();
                setSelectedObjectId(null);
            }
        },
        [isDragging, placementMode.active, setSelectedObjectId],
    );

    const handleCeoDeskClick = useCallback(
        (event: ThreeEvent<MouseEvent>) => {
            if (useAppStore.getState().placementMode.active) return;
            event.stopPropagation();
            setSelectedObjectId(null);
            setIsCeoWorkbenchOpen(true);
        },
        [setIsCeoWorkbenchOpen, setSelectedObjectId],
    );

    return {
        handleBackgroundClick,
        handleEmployeeClick,
        handleTeamClick,
        handleCeoDeskClick,
    };
}
