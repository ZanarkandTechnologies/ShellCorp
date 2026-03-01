"use client";

import { useMemo } from "react";
import { useChatStore } from "@/features/chat-system/chat-store";
import { useOfficeDataContext } from "@/providers/office-data-provider";

export function useChatContext(): {
    headerTitle: string;
    headerSubtitle?: string;
} {
    const currentEmployeeId = useChatStore((state) => state.currentEmployeeId);
    const currentTeamId = useChatStore((state) => state.currentTeamId);
    const { employees, teams } = useOfficeDataContext();

    const employee = useMemo(
        () => employees.find((item) => item._id === currentEmployeeId),
        [currentEmployeeId, employees],
    );
    const team = useMemo(
        () => teams.find((item) => item._id === currentTeamId),
        [currentTeamId, teams],
    );

    const headerTitle = useMemo(() => {
        if (employee?.name) return `Chat with ${employee.name}`;
        if (team?.name) return `${team.name} Chat`;
        if (currentEmployeeId) return `Chat with ${currentEmployeeId}`;
        if (currentTeamId) return `Team ${currentTeamId} Chat`;
        return "Chat";
    }, [currentEmployeeId, currentTeamId, employee?.name, team?.name]);

    return {
        headerTitle,
        headerSubtitle: employee?.jobTitle ?? (currentEmployeeId ? "Direct Message" : currentTeamId ? "Team Coordination" : undefined),
    };
}

