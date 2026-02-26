"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type ChatMode = "Chat" | "Files" | "Config";

export type LocalChatMessage = {
    key: string;
    role: "user" | "assistant";
    text: string;
    createdAt: number;
};

export type LocalChatThread = {
    _id: string;
    title: string;
    parentThreadId?: string;
};

type ChatState = {
    threadId: string | null;
    setThreadId: (id: string | null) => void;
    currentEmployeeId: string | null;
    setCurrentEmployeeId: (id: string | null) => void;
    currentTeamId: string | null;
    setCurrentTeamId: (id: string | null) => void;
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    isChatOpen: boolean;
    setIsChatOpen: (isOpen: boolean) => void;
    currentMode: ChatMode;
    setCurrentMode: (mode: ChatMode) => void;
    threads: LocalChatThread[];
    setThreads: (threads: LocalChatThread[]) => void;
    messagesByThread: Record<string, LocalChatMessage[]>;
    setMessagesByThread: (next: Record<string, LocalChatMessage[]>) => void;
};

function createThreadId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultThread(title: string): LocalChatThread {
    return {
        _id: createThreadId("thread"),
        title,
    };
}

export const useChatStore = create<ChatState>()(
    persist(
        (set) => ({
            threadId: null,
            setThreadId: (id) => set({ threadId: id }),
            currentEmployeeId: null,
            setCurrentEmployeeId: (id) => set({ currentEmployeeId: id }),
            currentTeamId: null,
            setCurrentTeamId: (id) => set({ currentTeamId: id }),
            sidebarOpen: true,
            setSidebarOpen: (open) => set({ sidebarOpen: open }),
            isChatOpen: false,
            setIsChatOpen: (isOpen) => set({ isChatOpen: isOpen }),
            currentMode: "Chat",
            setCurrentMode: (mode) => set({ currentMode: mode }),
            threads: [createDefaultThread("General Chat")],
            setThreads: (threads) => set({ threads }),
            messagesByThread: {},
            setMessagesByThread: (messagesByThread) => set({ messagesByThread }),
        }),
        {
            name: "shellcorp-chat-store",
            partialize: (state) => ({
                sidebarOpen: state.sidebarOpen,
                currentMode: state.currentMode,
            }),
        },
    ),
);

export function useChatActions(): {
    openEmployeeChat: (employeeId: string, openDialog?: boolean) => Promise<void>;
    openTeamChat: (teamId: string, openDialog?: boolean) => Promise<void>;
    createNewChat: (openDialog?: boolean) => Promise<void>;
} {
    const setThreadId = useChatStore((state) => state.setThreadId);
    const setIsChatOpen = useChatStore((state) => state.setIsChatOpen);
    const setCurrentEmployeeId = useChatStore((state) => state.setCurrentEmployeeId);
    const setCurrentTeamId = useChatStore((state) => state.setCurrentTeamId);
    const threads = useChatStore((state) => state.threads);
    const setThreads = useChatStore((state) => state.setThreads);

    return {
        async openEmployeeChat(employeeId: string, openDialog = true): Promise<void> {
            setCurrentEmployeeId(employeeId);
            setCurrentTeamId(null);
            const existing = threads.find((thread) => thread._id === `dm-${employeeId}`);
            if (existing) {
                setThreadId(existing._id);
            } else {
                const next = { _id: `dm-${employeeId}`, title: `Chat ${employeeId}` };
                setThreads([next, ...threads]);
                setThreadId(next._id);
            }
            if (openDialog) setIsChatOpen(true);
        },
        async openTeamChat(teamId: string, openDialog = true): Promise<void> {
            setCurrentTeamId(teamId);
            setCurrentEmployeeId(null);
            const existing = threads.find((thread) => thread._id === `team-${teamId}`);
            if (existing) {
                setThreadId(existing._id);
            } else {
                const next = { _id: `team-${teamId}`, title: `Team ${teamId}` };
                setThreads([next, ...threads]);
                setThreadId(next._id);
            }
            if (openDialog) setIsChatOpen(true);
        },
        async createNewChat(openDialog = true): Promise<void> {
            const next = createDefaultThread("New Chat");
            setThreads([next, ...threads]);
            setThreadId(next._id);
            setCurrentEmployeeId(null);
            setCurrentTeamId(null);
            if (openDialog) setIsChatOpen(true);
        },
    };
}

