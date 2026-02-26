"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ThreadItem {
    _id: string;
    title?: string;
    parentThreadId?: string;
}

interface ChatSidebarProps {
    threads: Array<ThreadItem> | undefined;
    subthreadsMap: Record<string, Array<ThreadItem>>;
    threadId: string | null;
    onThreadSelect: (threadId: string) => void;
    onNewThread: () => void;
    onDeleteChat: (threadId: string) => void;
    sidebarOpen: boolean;
    isCreatingThread?: boolean;
}

export function ChatSidebar({
    threads,
    threadId,
    onThreadSelect,
    onNewThread,
    onDeleteChat,
    sidebarOpen,
    isCreatingThread,
}: ChatSidebarProps) {
    const [hoveredThread, setHoveredThread] = useState<string | null>(null);

    return (
        <div className={cn("border-r bg-muted/10 transition-all duration-300 flex flex-col", sidebarOpen ? "w-64" : "w-0")}>
            {sidebarOpen ? (
                <>
                    <div className="p-4 border-b flex items-center justify-between">
                        <h2 className="font-semibold text-sm">Conversations</h2>
                        <Button size="sm" variant="ghost" onClick={onNewThread} disabled={isCreatingThread} className="h-8 w-8 p-0">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-1">
                            {threads?.map((thread) => (
                                <div
                                    key={thread._id}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-accent transition-colors group",
                                        thread._id === threadId ? "bg-accent" : "",
                                    )}
                                    onClick={() => onThreadSelect(thread._id)}
                                    onMouseEnter={() => setHoveredThread(thread._id)}
                                    onMouseLeave={() => setHoveredThread(null)}
                                >
                                    <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                    <span className="flex-1 min-w-0 text-sm truncate">{thread.title || "New Chat"}</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                            "h-6 w-6 p-0 opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive",
                                            hoveredThread === thread._id ? "opacity-100" : "",
                                        )}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onDeleteChat(thread._id);
                                        }}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </>
            ) : null}
        </div>
    );
}

