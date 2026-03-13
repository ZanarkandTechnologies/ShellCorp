/**
 * CHAT MESSAGE RENDERER
 * =====================
 * Renders plain chat bubbles plus structured working-output rows for thinking and tool activity.
 *
 * KEY CONCEPTS:
 * - Working output is only as rich as the preserved transcript/event payload.
 * - Tool rows use ai-elements primitives so inputs/results stay inspectable.
 *
 * USAGE:
 * - Render each `LocalChatMessage` in the chat dialog message list.
 *
 * MEMORY REFERENCES:
 * - MEM-0162
 */

import {
    Tool,
    ToolContent,
    ToolHeader,
    ToolInput,
    ToolOutput,
} from "@/components/ai-elements/tool";
import { CodeBlock } from "@/components/ai-elements/code-block";
import type { LocalChatMessage } from "@/features/chat-system/chat-store";
import { cn } from "@/lib/utils";

type WorkingOutputCard = {
    stream: string;
    phase: string;
    title: string;
    detail: string;
};

function parseWorkingOutput(text: string): WorkingOutputCard | null {
    const trimmed = text.trim();
    const matched = /^\[(tool|lifecycle|assistant)(?::([^\]]+))?\]\s*(.*)$/i.exec(trimmed);
    if (!matched) return null;
    const stream = (matched[1] ?? "").toLowerCase();
    const phase = (matched[2] ?? "").toLowerCase();
    const remainder = (matched[3] ?? "").trim();
    if (!remainder) {
        return {
            stream,
            phase,
            title: stream,
            detail: "",
        };
    }
    const splitIndex = remainder.indexOf(" - ");
    if (splitIndex < 0) {
        return {
            stream,
            phase,
            title: remainder,
            detail: "",
        };
    }
    return {
        stream,
        phase,
        title: remainder.slice(0, splitIndex).trim(),
        detail: remainder.slice(splitIndex + 3).trim(),
    };
}

function truncate(value: string, limit: number): string {
    return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function tryFormatJson(text: string): string | null {
    const trimmed = text.trim();
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;
    try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
        return null;
    }
}

function renderThinkingMessage(message: LocalChatMessage): JSX.Element | null {
    const part = message.parts?.find((entry) => entry.kind === "thinking");
    if (!part || part.kind !== "thinking") return null;
    const signatureText = part.signatureId ?? part.signatureType ?? (part.signature ? "present" : "");

    return (
        <div className="mb-3 flex justify-start">
            <div className="max-w-[92%] rounded-lg border border-border/70 bg-muted/60 px-3 py-2 text-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-background/80 px-1.5 py-0.5 font-medium uppercase tracking-wide">
                        thinking
                    </span>
                    {signatureText ? (
                        <span className="rounded bg-background/80 px-1.5 py-0.5 font-medium">
                            signature {truncate(signatureText, 24)}
                        </span>
                    ) : null}
                    {part.encrypted ? (
                        <span className="rounded bg-background/80 px-1.5 py-0.5 font-medium">encrypted</span>
                    ) : null}
                </div>
                <pre className="whitespace-pre-wrap break-words rounded bg-background/70 p-2 text-xs text-foreground">
                    {part.text?.trim() || message.text}
                </pre>
                {part.summary?.length ? (
                    <div className="mt-2 rounded bg-background/70 p-2 text-xs text-muted-foreground">
                        {part.summary.map((line, index) => (
                            <div key={`${message.key}-summary-${index}`}>{line}</div>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function renderToolMessage(message: LocalChatMessage): JSX.Element | null {
    const part = message.parts?.find((entry) => entry.kind === "tool");
    if (!part || part.kind !== "tool") return null;
    return (
        <div className="mb-3 flex justify-start">
            <div className="max-w-[92%] min-w-0 flex-1">
                <Tool defaultOpen={part.state !== "input-available"}>
                    <ToolHeader title={part.toolName} type={"tool-generic"} state={part.state} />
                    <ToolContent>
                        {part.input !== undefined ? <ToolInput input={part.input} /> : null}
                        {part.output !== undefined || part.errorText ? (
                            <ToolOutput output={part.output} errorText={part.errorText} />
                        ) : null}
                    </ToolContent>
                </Tool>
            </div>
        </div>
    );
}

export function MessageRenderer({
    message,
}: {
    message: LocalChatMessage;
    threadId?: string;
    isLatestMessage?: boolean;
    isStreaming?: boolean;
}) {
    const renderedThinking = renderThinkingMessage(message);
    if (renderedThinking) return renderedThinking;

    const renderedTool = renderToolMessage(message);
    if (renderedTool) return renderedTool;

    const workingCard = message.kind === "working_output" ? parseWorkingOutput(message.text) : null;
    if (workingCard) {
        return (
            <div className="mb-3 flex justify-start">
                <div className="max-w-[92%] rounded-lg border border-border/70 bg-muted/70 px-3 py-2 text-sm">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded bg-background/80 px-1.5 py-0.5 font-medium uppercase tracking-wide">
                            {workingCard.stream}
                        </span>
                        {workingCard.phase ? (
                            <span className="rounded bg-background/80 px-1.5 py-0.5 font-medium uppercase tracking-wide">
                                {workingCard.phase}
                            </span>
                        ) : null}
                    </div>
                    <div className="font-medium text-foreground">{workingCard.title}</div>
                    {workingCard.detail ? (
                        <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded bg-background/70 p-2 text-xs text-foreground">
                            {workingCard.detail}
                        </pre>
                    ) : null}
                </div>
            </div>
        );
    }

    const formattedJson = tryFormatJson(message.text);

    return (
        <div className={cn("mb-3 flex", message.role === "user" ? "justify-end" : "justify-start")}>
            <div
                className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                    message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
            >
                    {formattedJson ? (
                        <div className="min-w-0 overflow-hidden rounded-md bg-background/70">
                            <CodeBlock code={formattedJson} language="json" />
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap break-words">{message.text}</div>
                    )}
            </div>
        </div>
    );
}
