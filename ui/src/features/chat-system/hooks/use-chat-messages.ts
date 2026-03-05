"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
type AgentGatewayEventPayload = {
    runId: string;
    sessionKey?: string;
    stream?: string;
    seq?: number;
    data?: Record<string, unknown>;
};

type ToolProgressEntry = {
    name: string;
    command: string;
    lastOutput: string;
};

function normalizeSessionKey(value: string | null | undefined): string {
    if (!value) return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    return trimmed;
}

function matchesSessionKey(payloadSessionKey: string | undefined, effectiveSessionKey: string): boolean {
    const payloadKey = normalizeSessionKey(payloadSessionKey);
    const effectiveKey = normalizeSessionKey(effectiveSessionKey);
    if (!effectiveKey) return false;
    if (!payloadKey) return true;
    if (payloadKey === effectiveKey) return true;

    // Gateway may emit short keys (e.g., "main") while UI tracks fully qualified keys
    // (e.g., "agent:main:main"). Only allow trailing-segment fallback for short keys.
    const payloadHasScope = payloadKey.includes(":");
    const effectiveHasScope = effectiveKey.includes(":");
    if (payloadHasScope && effectiveHasScope) return false;

    const effectiveTail = effectiveKey.split(":").filter(Boolean).pop() ?? "";
    const payloadTail = payloadKey.split(":").filter(Boolean).pop() ?? "";
    return payloadTail.length > 0 && payloadTail === effectiveTail;
}

function createMessage(role: "user" | "assistant", text: string): LocalChatMessage {
    return {
        key: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        text,
        createdAt: Date.now(),
    };
}

function isToolResultRole(roleRaw: string): boolean {
    return roleRaw === "toolresult" || roleRaw === "tool_result";
}

function extractToolCallsFromContent(content: unknown): Array<{ name: string; args: unknown }> {
    if (!Array.isArray(content)) return [];
    return content
        .map((part) => {
            if (!part || typeof part !== "object") return null;
            const item = part as Record<string, unknown>;
            const type = typeof item.type === "string" ? item.type.toLowerCase() : "";
            if (type !== "toolcall" && type !== "tool_call" && type !== "tooluse" && type !== "tool_use") {
                return null;
            }
            const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : "tool";
            const args = item.arguments ?? item.args ?? item.input;
            return { name, args };
        })
        .filter((entry): entry is { name: string; args: unknown } => entry !== null);
}

function formatHistoryToolResult(row: Record<string, unknown>, text: string): string {
    const toolName =
        (typeof row.toolName === "string" && row.toolName.trim()) ||
        (typeof row.tool_name === "string" && row.tool_name.trim()) ||
        "tool";
    const output = summarizeToolOutput(text);
    if (!output) return `[tool:result] ${toolName}`;
    return `[tool:result] ${toolName} - Result: ${output}`;
}

function formatHistoryToolCall(name: string, args: unknown): string {
    const command = summarizeToolCommand(args);
    if (!command) return `[tool:start] ${name}`;
    return `[tool:start] ${name} - ${command}`;
}

function mapHistoryMessageToLocal(msg: unknown, index: number): LocalChatMessage | null {
    if (!msg || typeof msg !== "object") return null;
    const row = msg as Record<string, unknown>;
    const roleRaw = String(row.role ?? "").toLowerCase();
    const createdAt = typeof row.created_at === "number" ? row.created_at * 1000 : Date.now();

    if (isToolResultRole(roleRaw)) {
        const text = extractEventText(msg);
        return {
            key: `hist-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            role: "assistant",
            text: formatHistoryToolResult(row, text),
            createdAt,
            kind: "working_output",
        };
    }

    if (roleRaw === "assistant") {
        const toolCalls = extractToolCallsFromContent(row.content);
        if (toolCalls.length > 0) {
            const firstCall = toolCalls[0];
            return {
                key: `hist-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                role: "assistant",
                text: formatHistoryToolCall(firstCall.name, firstCall.args),
                createdAt,
                kind: "working_output",
            };
        }
    }

    const role = roleRaw === "user" ? "user" : roleRaw === "assistant" ? "assistant" : null;
    if (!role) return null;
    const text = extractEventText(msg);
    if (!text.trim()) return null;
    return {
        key: `hist-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        text,
        createdAt,
    };
}

function createAssistantMessage(text: string, kind: LocalChatMessage["kind"] = "default"): LocalChatMessage {
    return {
        key: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "assistant",
        text,
        createdAt: Date.now(),
        kind,
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

function stringifyWorkingValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function summarizeToolCommand(args: unknown): string {
    if (!args || typeof args !== "object") return "";
    const row = args as Record<string, unknown>;
    const command =
        (typeof row.rawCommand === "string" && row.rawCommand.trim()) ||
        (typeof row.command === "string" && row.command.trim()) ||
        (Array.isArray(row.command) ? row.command.filter((v) => typeof v === "string").join(" ") : "");
    if (command) return command;
    const path = typeof row.path === "string" ? row.path : "";
    if (path) return `read ${path}`;
    const serialized = stringifyWorkingValue(args);
    return serialized.length > 160 ? `${serialized.slice(0, 160)}...` : serialized;
}

function summarizeToolOutput(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value.length > 220 ? `${value.slice(0, 220)}...` : value;
    if (typeof value === "object") {
        const row = value as Record<string, unknown>;
        if (typeof row.text === "string") {
            return row.text.length > 220 ? `${row.text.slice(0, 220)}...` : row.text;
        }
        if (Array.isArray(row.content)) {
            const text = row.content
                .map((item) => {
                    if (!item || typeof item !== "object") return "";
                    const part = item as Record<string, unknown>;
                    return part.type === "text" && typeof part.text === "string" ? part.text : "";
                })
                .filter(Boolean)
                .join("\n")
                .trim();
            if (text) return text.length > 220 ? `${text.slice(0, 220)}...` : text;
        }
    }
    const serialized = stringifyWorkingValue(value);
    return serialized.length > 220 ? `${serialized.slice(0, 220)}...` : serialized;
}

function formatWorkingOutput(payload: AgentGatewayEventPayload, toolProgressById: Map<string, ToolProgressEntry>): string {
    const stream = String(payload.stream ?? "");
    const data = payload.data ?? {};
    if (stream === "tool") {
        const phase = typeof data.phase === "string" ? data.phase : "update";
        const toolCallId = typeof data.toolCallId === "string" ? data.toolCallId : "";
        const name = typeof data.name === "string" ? data.name : "tool";
        const existing = toolCallId ? toolProgressById.get(toolCallId) : undefined;
        const entry: ToolProgressEntry = existing ?? { name, command: "", lastOutput: "" };
        entry.name = name;

        
        if (phase === "start") {
            entry.command = summarizeToolCommand(data.args);
            if (toolCallId) toolProgressById.set(toolCallId, entry);
            if (!entry.command) return `[tool:start] ${name}`;
            return `[tool:start] ${name} - ${entry.command}`;
        }

        if (phase === "update") {
            const partial = summarizeToolOutput(data.partialResult);
            if (partial) entry.lastOutput = partial;
            if (toolCallId) toolProgressById.set(toolCallId, entry);
            return "";
        }

        if (phase !== "result") return "";

        const resultText =
            summarizeToolOutput(data.result) ||
            summarizeToolOutput(data.summary ?? data.error ?? data.status) ||
            entry.lastOutput;
        const detailParts: string[] = [];
        if (entry.command) detailParts.push(`Command: ${entry.command}`);
        if (resultText) detailParts.push(`Result: ${resultText}`);
        const formatted =
            detailParts.length > 0 ? `[tool:result] ${name} - ${detailParts.join("\n")}` : `[tool:result] ${name}`;
        if (toolCallId) toolProgressById.delete(toolCallId);

        return formatted;
    }
    if (stream === "lifecycle") return "";
    if (stream === "assistant") {
        const text = typeof data.text === "string" ? data.text.trim() : "";
        if (text) return "";
        const detail = stringifyWorkingValue(data);
        return detail ? `[assistant] ${detail}` : "";
    }
    if (stream) {
        const detail = stringifyWorkingValue(data);
        return detail ? `[${stream}] ${detail}` : `[${stream}]`;
    }
    return "";
}

function isWorkingOutputMessage(message: LocalChatMessage): boolean {
    if (message.kind === "working_output") return true;
    if (message.role !== "assistant") return false;
    const text = message.text.trim();
    return text.startsWith("[tool:") || text.startsWith("[lifecycle:") || text.startsWith("[assistant]");
}

function shouldDisplayWorkingOutputMessage(message: LocalChatMessage): boolean {
    const text = message.text.trim();
    if (text.startsWith("[tool:start]")) return true;
    if (text.startsWith("[tool:result]")) return true;
    return !isWorkingOutputMessage(message);
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
    const completedRunIdsRef = useRef<Set<string>>(new Set());
    const messagesByThread = useChatStore((state) => state.messagesByThread);
    const selectedAgentId = useAppStore((state) => state.selectedAgentId);
    const selectedSessionKey = useAppStore((state) => state.selectedSessionKey);
    const showWorkingOutput = useChatStore((state) => state.showWorkingOutput);
    const { client } = useGateway();
    const seenAgentEventIdsRef = useRef<Set<string>>(new Set());
    const toolProgressByIdRef = useRef<Map<string, ToolProgressEntry>>(new Map());

    const messages = useMemo(() => {
        if (!threadId) return [];
        const threadMessages = messagesByThread[threadId] ?? [];
        const visibilityFiltered = showWorkingOutput
            ? threadMessages.filter((message) => shouldDisplayWorkingOutputMessage(message))
            : threadMessages.filter((message) => !isWorkingOutputMessage(message));
        return visibilityFiltered;
    }, [messagesByThread, showWorkingOutput, threadId]);

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

            const isTerminalState = payload.state === "final" || payload.state === "aborted" || payload.state === "error";
            if (isTerminalState && payload.runId && completedRunIdsRef.current.has(payload.runId)) {
                return;
            }

            const text = extractEventText(payload.message);
            const runMismatch = payload.runId && activeRunId && payload.runId !== activeRunId;
            if (runMismatch) return;

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
                if (payload.runId) {
                    completedRunIdsRef.current.add(payload.runId);
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
                if (payload.runId) {
                    completedRunIdsRef.current.add(payload.runId);
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
                if (payload.runId) {
                    completedRunIdsRef.current.add(payload.runId);
                }
                setStreamingText("");
                setActiveRunId(null);
                setSubmissionStatus("ready");
            }

        });
        return unsubscribe;
    }, [activeRunId, client, effectiveSessionKey, effectiveThreadId, showWorkingOutput, streamingText]);

    useEffect(() => {
        seenAgentEventIdsRef.current.clear();
    }, [effectiveSessionKey, showWorkingOutput]);

    useEffect(() => {
        if (!showWorkingOutput || !effectiveThreadId || !effectiveSessionKey) return;
        const unsubscribe = client.subscribe((event) => {
            if (event.event !== "agent") return;
            const payload = event.payload as AgentGatewayEventPayload | undefined;
            if (!payload) return;

            if (!matchesSessionKey(payload.sessionKey, effectiveSessionKey)) {
                return;
            }

            const runMismatch = payload.runId && activeRunId && payload.runId !== activeRunId;
            if (runMismatch && submissionStatus !== "streaming") {
                return;
            }

            const eventId = `${payload.runId ?? "run"}:${String(payload.seq ?? "seq")}:${String(payload.stream ?? "")}`;
            if (seenAgentEventIdsRef.current.has(eventId)) return;
            seenAgentEventIdsRef.current.add(eventId);

            const text = formatWorkingOutput(payload, toolProgressByIdRef.current);
            if (!text.trim()) return;

            const nextMessages = useChatStore.getState().messagesByThread[effectiveThreadId] ?? [];
            useChatStore.getState().setMessagesByThread({
                ...useChatStore.getState().messagesByThread,
                [effectiveThreadId]: [...nextMessages, createAssistantMessage(text, "working_output")],
            });
        });
        return unsubscribe;
    }, [activeRunId, client, effectiveSessionKey, effectiveThreadId, showWorkingOutput, submissionStatus]);

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
            completedRunIdsRef.current.delete(runId);
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

