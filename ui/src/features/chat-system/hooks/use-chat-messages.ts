"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useChatStore, type LocalChatMessage } from "@/features/chat-system/chat-store";
import { useAppStore } from "@/lib/app-store";
import { useGateway } from "@/providers/gateway-provider";

type SubmissionStatus = "submitted" | "streaming" | "ready";
type ChatGatewayEventPayload = {
    runId: string;
    sessionKey: string;
    state: "delta" | "final" | "aborted" | "error";
    message?: unknown;
    errorMessage?: string;
};

function createMessage(role: "user" | "assistant", text: string): LocalChatMessage {
    return {
        key: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        text,
        createdAt: Date.now(),
    };
}

function mapHistoryMessageToLocal(msg: unknown, index: number): LocalChatMessage | null {
    if (!msg || typeof msg !== "object") return null;
    const row = msg as Record<string, unknown>;
    const roleRaw = String(row.role ?? "").toLowerCase();
    const role = roleRaw === "user" ? "user" : roleRaw === "assistant" ? "assistant" : null;
    if (!role) return null;
    const text = extractEventText(msg);
    if (!text.trim()) return null;
    return {
        key: `hist-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        text,
        createdAt: typeof row.created_at === "number" ? row.created_at * 1000 : Date.now(),
    };
}

function createAssistantMessage(text: string): LocalChatMessage {
    return {
        key: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "assistant",
        text,
        createdAt: Date.now(),
    };
}

function extractEventText(message: unknown): string {
    if (!message || typeof message !== "object") return "";
    const row = message as Record<string, unknown>;
    if (typeof row.text === "string") return row.text.trim();
    if (typeof row.content === "string") return row.content.trim();
    if (!Array.isArray(row.content)) return "";
    return row.content
        .map((part) => {
            if (!part || typeof part !== "object") return "";
            const item = part as Record<string, unknown>;
            if (item.type === "text" && typeof item.text === "string") return item.text;
            return "";
        })
        .filter(Boolean)
        .join("\n")
        .trim();
}

export function useChatMessages(threadId: string | null): {
    messages: LocalChatMessage[];
    handleSubmit: (messageParam: unknown) => Promise<void>;
    abort: () => Promise<void>;
    submissionStatus: SubmissionStatus;
    isStreaming: boolean;
    streamingText: string;
} {
    const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>("ready");
    const [streamingText, setStreamingText] = useState("");
    const [activeRunId, setActiveRunId] = useState<string | null>(null);
    const messagesByThread = useChatStore((state) => state.messagesByThread);
    const selectedAgentId = useAppStore((state) => state.selectedAgentId);
    const selectedSessionKey = useAppStore((state) => state.selectedSessionKey);
    const { client } = useGateway();

    const messages = useMemo(() => {
        if (!threadId) return [];
        return messagesByThread[threadId] ?? [];
    }, [messagesByThread, threadId]);

    const effectiveSessionKey = selectedSessionKey ?? threadId;
    const effectiveThreadId = threadId ?? selectedSessionKey;

    useEffect(() => {
        if (!effectiveSessionKey) return;
        let cancelled = false;
        setStreamingText("");
        setActiveRunId(null);
        setSubmissionStatus("ready");
        async function loadHistory(): Promise<void> {
            try {
                const result = await client.request<{ messages?: unknown[] }>("chat.history", {
                    sessionKey: effectiveSessionKey,
                    limit: 200,
                });
                if (cancelled) return;
                const raw = Array.isArray(result?.messages) ? result.messages : [];
                const mapped = raw
                    .map((msg, i) => mapHistoryMessageToLocal(msg, i))
                    .filter((m): m is LocalChatMessage => m !== null);
                useChatStore.getState().setMessagesByThread({
                    ...useChatStore.getState().messagesByThread,
                    [effectiveSessionKey]: mapped,
                });
            } catch {
                if (!cancelled) {
                    // Keep previous messages on fetch failures to avoid blanking UI.
                }
            }
        }
        void loadHistory();
        return () => {
            cancelled = true;
        };
    }, [client, effectiveSessionKey]);

    useEffect(() => {
        const unsubscribe = client.subscribe((event) => {
            if (event.event !== "chat") return;
            const payload = event.payload as ChatGatewayEventPayload | undefined;
            if (!payload || !effectiveThreadId || !effectiveSessionKey) return;
            if (payload.sessionKey !== effectiveSessionKey) return;

            const text = extractEventText(payload.message);
            const runMismatch = payload.runId && activeRunId && payload.runId !== activeRunId;
            if (runMismatch && payload.state !== "final") return;

            if (payload.state === "delta") {
                setSubmissionStatus("streaming");
                if (!text) return;
                setStreamingText((current) => (text.length >= current.length ? text : current));
                return;
            }

            if (payload.state === "final") {
                const finalText = text || streamingText;
                if (finalText.trim()) {
                    const nextMessages = useChatStore.getState().messagesByThread[effectiveThreadId] ?? [];
                    useChatStore.getState().setMessagesByThread({
                        ...useChatStore.getState().messagesByThread,
                        [effectiveThreadId]: [...nextMessages, createAssistantMessage(finalText)],
                    });
                }
                setStreamingText("");
                setActiveRunId(null);
                setSubmissionStatus("ready");
                return;
            }

            if (payload.state === "aborted") {
                const abortedText = text || streamingText;
                if (abortedText.trim()) {
                    const nextMessages = useChatStore.getState().messagesByThread[effectiveThreadId] ?? [];
                    useChatStore.getState().setMessagesByThread({
                        ...useChatStore.getState().messagesByThread,
                        [effectiveThreadId]: [...nextMessages, createAssistantMessage(abortedText)],
                    });
                }
                setStreamingText("");
                setActiveRunId(null);
                setSubmissionStatus("ready");
                return;
            }

            if (payload.state === "error") {
                const errorText = payload.errorMessage?.trim() || "chat error";
                const nextMessages = useChatStore.getState().messagesByThread[effectiveThreadId] ?? [];
                useChatStore.getState().setMessagesByThread({
                    ...useChatStore.getState().messagesByThread,
                    [effectiveThreadId]: [...nextMessages, createAssistantMessage(`Error: ${errorText}`)],
                });
                setStreamingText("");
                setActiveRunId(null);
                setSubmissionStatus("ready");
            }
        });
        return unsubscribe;
    }, [activeRunId, client, effectiveSessionKey, effectiveThreadId, streamingText]);

    const handleSubmit = useCallback(
        async (messageParam: unknown): Promise<void> => {
            if (!selectedAgentId || !effectiveSessionKey || !effectiveThreadId) {
                const nextMessages = useChatStore.getState().messagesByThread[effectiveThreadId ?? "unbound"] ?? [];
                if (effectiveThreadId) {
                    useChatStore.getState().setMessagesByThread({
                        ...useChatStore.getState().messagesByThread,
                        [effectiveThreadId]: [...nextMessages, createAssistantMessage("Error: no active agent/session selected")],
                    });
                }
                setSubmissionStatus("ready");
                return;
            }
            const raw = messageParam as { text?: string };
            const text = (raw?.text ?? "").trim();
            if (!text) return;

            setSubmissionStatus("submitted");
            const current = useChatStore.getState().messagesByThread[effectiveThreadId] ?? [];
            const userMessage = createMessage("user", text);
            useChatStore.getState().setMessagesByThread({
                ...useChatStore.getState().messagesByThread,
                [effectiveThreadId]: [...current, userMessage],
            });
            setSubmissionStatus("streaming");
            setStreamingText("");
            const runId =
                typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                    ? crypto.randomUUID()
                    : `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            setActiveRunId(runId);

            try {
                await client.request("chat.send", {
                    sessionKey: effectiveSessionKey,
                    message: text,
                    deliver: false,
                    idempotencyKey: runId,
                });
            } catch (error) {
                const nextMessages = useChatStore.getState().messagesByThread[effectiveThreadId] ?? [];
                useChatStore.getState().setMessagesByThread({
                    ...useChatStore.getState().messagesByThread,
                    [effectiveThreadId]: [
                        ...nextMessages,
                        createAssistantMessage(error instanceof Error ? `Error: ${error.message}` : "Error: message_send_failed"),
                    ],
                });
                setStreamingText("");
                setActiveRunId(null);
                setSubmissionStatus("ready");
            }
        },
        [client, effectiveSessionKey, effectiveThreadId, selectedAgentId],
    );

    const abort = useCallback(async (): Promise<void> => {
        if (!effectiveSessionKey) return;
        try {
            await client.request("chat.abort", { sessionKey: effectiveSessionKey });
        } catch {
            // Ignore abort errors; streaming handler will receive aborted event
        }
    }, [client, effectiveSessionKey]);

    return {
        messages,
        handleSubmit,
        abort,
        submissionStatus,
        isStreaming: submissionStatus === "streaming",
        streamingText,
    };
}

