"use client";

import { useCallback } from "react";
import { useChatStore } from "@/features/chat-system/chat-store";

export function useChatThreads(): {
    threads: Array<{ _id: string; title?: string; parentThreadId?: string }>;
    subthreadsMap: Record<string, Array<{ _id: string; title?: string; parentThreadId?: string }>>;
    threadId: string | null;
    setThreadId: (threadId: string) => void;
    handleNewThread: () => void;
    handleDeleteThread: (threadId: string) => void;
    isCreatingThread: boolean;
} {
    const threads = useChatStore((state) => state.threads);
    const setThreads = useChatStore((state) => state.setThreads);
    const threadId = useChatStore((state) => state.threadId);
    const setThreadIdRaw = useChatStore((state) => state.setThreadId);
    const messagesByThread = useChatStore((state) => state.messagesByThread);
    const setMessagesByThread = useChatStore((state) => state.setMessagesByThread);

    const setThreadId = useCallback(
        (nextThreadId: string): void => {
            setThreadIdRaw(nextThreadId);
        },
        [setThreadIdRaw],
    );

    const handleNewThread = useCallback((): void => {
        const id = `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setThreads([{ _id: id, title: "New Chat" }, ...threads]);
        setThreadIdRaw(id);
    }, [setThreadIdRaw, setThreads, threads]);

    const handleDeleteThread = useCallback(
        (deleteThreadId: string): void => {
            const nextThreads = threads.filter((thread) => thread._id !== deleteThreadId);
            setThreads(nextThreads);
            if (threadId === deleteThreadId) {
                setThreadIdRaw(nextThreads[0]?._id ?? null);
            }
            if (messagesByThread[deleteThreadId]) {
                const nextMessagesByThread = { ...messagesByThread };
                delete nextMessagesByThread[deleteThreadId];
                setMessagesByThread(nextMessagesByThread);
            }
        },
        [messagesByThread, setMessagesByThread, setThreadIdRaw, setThreads, threadId, threads],
    );

    return {
        threads,
        subthreadsMap: {},
        threadId,
        setThreadId,
        handleNewThread,
        handleDeleteThread,
        isCreatingThread: false,
    };
}

