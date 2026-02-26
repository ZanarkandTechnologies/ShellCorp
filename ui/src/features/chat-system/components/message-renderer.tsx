import type { LocalChatMessage } from "@/features/chat-system/chat-store";
import { cn } from "@/lib/utils";

export function MessageRenderer({
    message,
}: {
    message: LocalChatMessage;
    threadId?: string;
    isLatestMessage?: boolean;
    isStreaming?: boolean;
}) {
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

