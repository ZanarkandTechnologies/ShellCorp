"use client";

/**
 * CHAT MESSAGE HOOKS
 * ==================
 * Maps OpenClaw chat history and live gateway events into local chat rows.
 *
 * KEY CONCEPTS:
 * - Preserve structured working-output parts (thinking + tool activity) instead of flattening them early.
 * - Keep plain assistant/user text as standard chat bubbles so the working-output toggle remains useful.
 *
 * USAGE:
 * - `useChatMessages(threadId)` inside the chat dialog.
 *
 * MEMORY REFERENCES:
 * - MEM-0162
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChatStore, type LocalChatMessage, type LocalChatPart } from "../chat-store";
import {
    formatWorkingOutput as formatStructuredWorkingOutput,
    mapHistoryMessageToLocal as mapHistoryMessages,
    type ToolProgressEntry as SharedToolProgressEntry,
} from "../chat-message-utils";
import { useAppStore } from "../../../lib/app-store";
import { useGateway } from "../../../providers/gateway-provider";

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

function createStructuredMessage(args: {
    role?: "user" | "assistant";
    text: string;
    createdAt: number;
    kind?: LocalChatMessage["kind"];
    parts?: LocalChatPart[];
    keySuffix?: string;
}): LocalChatMessage {
    const role = args.role ?? "assistant";
    return {
        key: `${role}-${args.createdAt}-${Math.random().toString(36).slice(2, 8)}${args.keySuffix ? `-${args.keySuffix}` : ""}`,
        role,
        text: args.text,
        createdAt: args.createdAt,
        kind: args.kind,
        ...(args.parts?.length ? { parts: args.parts } : {}),
    };
}

function isToolResultRole(roleRaw: string): boolean {
    return roleRaw === "toolresult" || roleRaw === "tool_result";
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

function safeTrimString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function parseThinkingSignature(value: unknown): Pick<
    Extract<LocalChatPart, { kind: "thinking" }>,
    "signature" | "signatureId" | "signatureType" | "encrypted" | "summary"
> {
    const rawSignature = safeTrimString(value);
    if (!rawSignature) return {};
    try {
        const parsed = JSON.parse(rawSignature) as Record<string, unknown>;
        const signatureId = safeTrimString(parsed.id);
        const signatureType = safeTrimString(parsed.type);
        const encrypted = typeof parsed.encrypted_content === "string" && parsed.encrypted_content.length > 0;
        const summary = Array.isArray(parsed.summary)
            ? parsed.summary.map((item) => safeTrimString(item)).filter(Boolean)
            : undefined;
        return {
            signature: rawSignature,
            ...(signatureId ? { signatureId } : {}),
            ...(signatureType ? { signatureType } : {}),
            ...(encrypted ? { encrypted } : {}),
            ...(summary?.length ? { summary } : {}),
        };
    } catch {
        return {
            signature: rawSignature,
            ...(rawSignature ? { signatureType: rawSignature } : {}),
        };
    }
}

function formatThinkingSummary(part: Extract<LocalChatPart, { kind: "thinking" }>): string {
    if (part.text?.trim()) return part.text.trim();
    if (part.summary?.length) return part.summary.join("\n");
    if (part.encrypted) return "Reasoning signature stored, but transcript does not contain readable thinking text.";
    return "Reasoning metadata captured without readable thinking text.";
}

function mapAssistantContentToLocalMessages(
    content: unknown,
    createdAt: number,
    index: number,
): LocalChatMessage[] {
    if (!Array.isArray(content)) return [];
    const messages: LocalChatMessage[] = [];
    const textChunks: string[] = [];

    content.forEach((part, partIndex) => {
        if (!part || typeof part !== "object") return;
        const item = part as Record<string, unknown>;
        const type = safeTrimString(item.type).toLowerCase();
        if (type === "text") {
            const text = safeTrimString(item.text);
            if (text) textChunks.push(text);
            return;
        }
        if (type === "thinking") {
            const thinkingText = safeTrimString(item.thinking) || safeTrimString(item.text);
            const thinkingPart: Extract<LocalChatPart, { kind: "thinking" }> = {
                kind: "thinking",
                ...(thinkingText ? { text: thinkingText } : {}),
                ...parseThinkingSignature(item.thinkingSignature),
            };
            messages.push(
                createStructuredMessage({
                    text: formatThinkingSummary(thinkingPart),
                    createdAt,
                    kind: "working_output",
                    parts: [thinkingPart],
                    keySuffix: `hist-${index}-thinking-${partIndex}`,
                }),
            );
            return;
        }
        if (type === "toolcall" || type === "tool_call" || type === "tooluse" || type === "tool_use") {
            const toolName = safeTrimString(item.name) || "tool";
            const input = item.arguments ?? item.args ?? item.input;
            messages.push(
                createStructuredMessage({
                    text: formatHistoryToolCall(toolName, input),
                    createdAt,
                    kind: "working_output",
                    parts: [
                        {
                            kind: "tool",
                            toolName,
                            state: "input-available",
                            ...(input !== undefined ? { input } : {}),
                        },
                    ],
                    keySuffix: `hist-${index}-tool-call-${partIndex}`,
                }),
            );
            return;
        }
        if (type === "toolresult" || type === "tool_result") {
            const toolName = safeTrimString(item.name) || safeTrimString(item.toolName) || "tool";
            const output = item.result ?? item.output ?? item.content ?? item.text;
            const errorText = safeTrimString(item.errorText) || safeTrimString(item.error);
            messages.push(
                createStructuredMessage({
                    text: errorText ? `[tool:error] ${toolName} - ${errorText}` : `[tool:result] ${toolName}`,
                    createdAt,
                    kind: "working_output",
                    parts: [
                        {
                            kind: "tool",
                            toolName,
                            state: errorText ? "output-error" : "output-available",
                            ...(output !== undefined ? { output } : {}),
                            ...(errorText ? { errorText } : {}),
                        },
                    ],
                    keySuffix: `hist-${index}-tool-result-${partIndex}`,
                }),
            );
        }
    });

    const assistantText = textChunks.join("\n").trim();
    if (assistantText) {
        messages.push(
            createStructuredMessage({
                text: assistantText,
                createdAt,
                keySuffix: `hist-${index}-text`,
            }),
        );
    }

    return messages;
}

export function mapHistoryMessageToLocal(msg: unknown, index: number): LocalChatMessage[] {
    if (!msg || typeof msg !== "object") return [];
    const row = msg as Record<string, unknown>;
    const roleRaw = String(row.role ?? "").toLowerCase();
    const createdAt = typeof row.created_at === "number" ? row.created_at * 1000 : Date.now();

    if (isToolResultRole(roleRaw)) {
        const text = extractEventText(msg);
        const toolName =
            (typeof row.toolName === "string" && row.toolName.trim()) ||
            (typeof row.tool_name === "string" && row.tool_name.trim()) ||
            "tool";
        const errorText =
            (typeof row.error === "string" && row.error.trim()) ||
            (typeof row.errorText === "string" && row.errorText.trim()) ||
            undefined;
        return [
            createStructuredMessage({
                text: formatHistoryToolResult(row, text),
                createdAt,
                kind: "working_output",
                parts: [
                    {
                        kind: "tool",
                        toolName,
                        state: errorText ? "output-error" : "output-available",
                        ...(text ? { output: text } : {}),
                        ...(errorText ? { errorText } : {}),
                    },
                ],
                keySuffix: `hist-${index}-tool-result`,
            }),
        ];
    }

    if (roleRaw === "assistant") {
        const mapped = mapAssistantContentToLocalMessages(row.content, createdAt, index);
        if (mapped.length > 0) {
            return mapped;
        }
    }

    const role = roleRaw === "user" ? "user" : roleRaw === "assistant" ? "assistant" : null;
    if (!role) return [];
    const text = extractEventText(msg);
    if (!text.trim()) return [];
    return [createStructuredMessage({ role, text, createdAt, keySuffix: `hist-${index}` })];
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

export function formatWorkingOutput(
    payload: AgentGatewayEventPayload,
    toolProgressById: Map<string, ToolProgressEntry>,
): LocalChatMessage | null {
    const stream = String(payload.stream ?? "");
    const data = payload.data ?? {};
    const createdAt = Date.now();
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
            return createStructuredMessage({
                text: !entry.command ? `[tool:start] ${name}` : `[tool:start] ${name} - ${entry.command}`,
                createdAt,
                kind: "working_output",
                parts: [
                    {
                        kind: "tool",
                        toolName: name,
                        state: "input-available",
                        ...(data.args !== undefined ? { input: data.args } : {}),
                    },
                ],
            });
        }

        if (phase === "update") {
            const partial = summarizeToolOutput(data.partialResult);
            if (partial) entry.lastOutput = partial;
            if (toolCallId) toolProgressById.set(toolCallId, entry);
            return null;
        }

        if (phase !== "result") return null;

        const resultText =
            summarizeToolOutput(data.result) ||
            summarizeToolOutput(data.summary ?? data.error ?? data.status) ||
            entry.lastOutput;
        const errorText = typeof data.error === "string" ? data.error : "";
        if (toolCallId) toolProgressById.delete(toolCallId);
        return createStructuredMessage({
            text: resultText ? `[tool:result] ${name} - ${resultText}` : `[tool:result] ${name}`,
            createdAt,
            kind: "working_output",
            parts: [
                {
                    kind: "tool",
                    toolName: name,
                    state: errorText ? "output-error" : "output-available",
                    ...(entry.command ? { input: entry.command } : data.args !== undefined ? { input: data.args } : {}),
                    ...(data.result !== undefined
                        ? { output: data.result }
                        : resultText
                          ? { output: resultText }
                          : {}),
                    ...(errorText ? { errorText } : {}),
                },
            ],
        });
    }
    if (stream === "lifecycle") return null;
    if (stream === "assistant") {
        const text = typeof data.text === "string" ? data.text.trim() : "";
        if (text) return null;
        const thinking = safeTrimString(data.thinking) || safeTrimString(data.reasoning);
        if (thinking) {
            const thinkingPart: Extract<LocalChatPart, { kind: "thinking" }> = {
                kind: "thinking",
                text: thinking,
                ...parseThinkingSignature(data.thinkingSignature),
            };
            return createStructuredMessage({
                text: formatThinkingSummary(thinkingPart),
                createdAt,
                kind: "working_output",
                parts: [thinkingPart],
            });
        }
        const detail = stringifyWorkingValue(data);
        return detail ? createStructuredMessage({ text: `[assistant] ${detail}`, createdAt, kind: "working_output" }) : null;
    }
    if (stream) {
        const detail = stringifyWorkingValue(data);
        return detail
            ? createStructuredMessage({ text: `[${stream}] ${detail}`, createdAt, kind: "working_output" })
            : createStructuredMessage({ text: `[${stream}]`, createdAt, kind: "working_output" });
    }
    return null;
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
    const toolProgressByIdRef = useRef<Map<string, SharedToolProgressEntry>>(new Map());

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

    const reloadHistory = useCallback(
        async (sessionKey: string): Promise<LocalChatMessage[]> => {
            const result = await client.request<{ messages?: unknown[] }>("chat.history", {
                sessionKey,
                limit: 200,
            });
            const raw = Array.isArray(result?.messages) ? result.messages : [];
            return raw.flatMap((msg, i) => mapHistoryMessages(msg, i));
        },
        [client],
    );

    useEffect(() => {
        if (!effectiveSessionKey) return;
        let cancelled = false;
        setStreamingText("");
        setActiveRunId(null);
        setSubmissionStatus("ready");
        async function loadHistory(): Promise<void> {
            try {
                const mapped = await reloadHistory(effectiveSessionKey);
                if (cancelled) return;
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
    }, [effectiveSessionKey, reloadHistory]);

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
                } else {
                    void reloadHistory(effectiveSessionKey)
                        .then((mapped) => {
                            useChatStore.getState().setMessagesByThread({
                                ...useChatStore.getState().messagesByThread,
                                [effectiveThreadId]: mapped,
                            });
                        })
                        .catch(() => {
                            // Ignore history refresh failures on terminal event fallback.
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
    }, [activeRunId, client, effectiveSessionKey, effectiveThreadId, reloadHistory, showWorkingOutput, streamingText]);

    useEffect(() => {
        if (submissionStatus !== "streaming" || !effectiveSessionKey || !effectiveThreadId) return;
        let cancelled = false;
        const startedCount = (useChatStore.getState().messagesByThread[effectiveThreadId] ?? []).length;
        const timer = window.setTimeout(() => {
            void reloadHistory(effectiveSessionKey)
                .then((mapped) => {
                    if (cancelled) return;
                    const lastMessage = mapped[mapped.length - 1];
                    if (!lastMessage || lastMessage.role !== "assistant" || mapped.length <= startedCount) return;
                    useChatStore.getState().setMessagesByThread({
                        ...useChatStore.getState().messagesByThread,
                        [effectiveThreadId]: mapped,
                    });
                    setStreamingText("");
                    setActiveRunId(null);
                    setSubmissionStatus("ready");
                })
                .catch(() => {
                    // Ignore fallback history refresh failures while streaming.
                });
        }, 6000);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [effectiveSessionKey, effectiveThreadId, reloadHistory, submissionStatus]);

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

            const message = formatStructuredWorkingOutput(payload, toolProgressByIdRef.current);
            if (!message) return;

            const nextMessages = useChatStore.getState().messagesByThread[effectiveThreadId] ?? [];
            useChatStore.getState().setMessagesByThread({
                ...useChatStore.getState().messagesByThread,
                [effectiveThreadId]: [...nextMessages, message],
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
