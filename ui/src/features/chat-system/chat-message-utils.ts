/**
 * CHAT MESSAGE UTILS
 * ==================
 * Pure helpers for turning transcript/history rows and live tool events into local chat rows.
 *
 * KEY CONCEPTS:
 * - Preserve structured thinking/tool payloads for rendering.
 * - Keep output toggle behavior by emitting working-output rows separately from final assistant text.
 *
 * USAGE:
 * - Imported by chat hooks and unit tests.
 *
 * MEMORY REFERENCES:
 * - MEM-0163
 */

import type { LocalChatMessage, LocalChatPart } from "./chat-store";

export type AgentGatewayEventPayload = {
    runId: string;
    sessionKey?: string;
    stream?: string;
    seq?: number;
    data?: Record<string, unknown>;
};

export type ToolProgressEntry = {
    name: string;
    command: string;
    lastOutput: string;
};

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

function safeTrimString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
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

function mapAssistantContentToLocalMessages(content: unknown, createdAt: number, index: number): LocalChatMessage[] {
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
        messages.push(createStructuredMessage({ text: assistantText, createdAt, keySuffix: `hist-${index}-text` }));
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
        if (mapped.length > 0) return mapped;
    }

    const role = roleRaw === "user" ? "user" : roleRaw === "assistant" ? "assistant" : null;
    if (!role) return [];
    const text = extractEventText(msg);
    if (!text.trim()) return [];
    return [createStructuredMessage({ role, text, createdAt, keySuffix: `hist-${index}` })];
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

    if (!stream) return null;
    const detail = stringifyWorkingValue(data);
    return detail
        ? createStructuredMessage({ text: `[${stream}] ${detail}`, createdAt, kind: "working_output" })
        : createStructuredMessage({ text: `[${stream}]`, createdAt, kind: "working_output" });
}
