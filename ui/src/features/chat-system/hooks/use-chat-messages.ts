"use client";

import { useCallback, useMemo, useState } from "react";
import { useChatStore, type LocalChatMessage } from "@/features/chat-system/chat-store";

type SubmissionStatus = "submitted" | "streaming" | "ready";

function createMessage(role: "user" | "assistant", text: string): LocalChatMessage {
    return {
        key: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        text,
        createdAt: Date.now(),
    };
}

export function useChatMessages(threadId: string | null): {
    messages: LocalChatMessage[];
    handleSubmit: (messageParam: unknown) => Promise<void>;
    submissionStatus: SubmissionStatus;
    isStreaming: boolean;
} {
    const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>("ready");
    const messagesByThread = useChatStore((state) => state.messagesByThread);
    const setMessagesByThread = useChatStore((state) => state.setMessagesByThread);

    const messages = useMemo(() => {
        if (!threadId) return [];
        return messagesByThread[threadId] ?? [];
    }, [messagesByThread, threadId]);

    const handleSubmit = useCallback(
        async (messageParam: unknown): Promise<void> => {
            if (!threadId) return;
            const raw = messageParam as { text?: string };
            const text = (raw?.text ?? "").trim();
            if (!text) return;

            setSubmissionStatus("submitted");
            const current = messagesByThread[threadId] ?? [];
            const userMessage = createMessage("user", text);
            setMessagesByThread({
                ...messagesByThread,
                [threadId]: [...current, userMessage],
            });
            setSubmissionStatus("streaming");

            // Frontend-only fallback response while backend parity is pending.
            setTimeout(() => {
                const next = useChatStore.getState().messagesByThread[threadId] ?? [];
                const assistantReply = createMessage("assistant", "Acknowledged. Backend parity wiring is pending.");
                useChatStore.getState().setMessagesByThread({
                    ...useChatStore.getState().messagesByThread,
                    [threadId]: [...next, assistantReply],
                });
                setSubmissionStatus("ready");
            }, 500);
        },
        [messagesByThread, setMessagesByThread, threadId],
    );

    return {
        messages,
        handleSubmit,
        submissionStatus,
        isStreaming: submissionStatus === "streaming",
    };
}

