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

export function MessageRenderer({
    message,
}: {
    message: LocalChatMessage;
    threadId?: string;
    isLatestMessage?: boolean;
    isStreaming?: boolean;
}) {
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

    return (
        <div className={cn("mb-3 flex", message.role === "user" ? "justify-end" : "justify-start")}>
            <div
                className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                    message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
            >
                {message.text}
            </div>
        </div>
    );
}

