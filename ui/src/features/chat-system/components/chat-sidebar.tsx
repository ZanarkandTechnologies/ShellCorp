"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    onDeleteChat: (threadId: string) => Promise<{ ok: boolean; error?: string }>;
    sidebarOpen: boolean;
    isCreatingThread?: boolean;
    disableNewThread?: boolean;
}

export function ChatSidebar({
    threads,
    threadId,
    onThreadSelect,
    onNewThread,
    onDeleteChat,
    sidebarOpen,
    isCreatingThread,
    disableNewThread,
}: ChatSidebarProps) {
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string>("");
    const [isDeleting, setIsDeleting] = useState(false);
    const deleteTarget = threads?.find((thread) => thread._id === deleteTargetId) ?? null;

    // #region agent log
    useEffect(() => {
        fetch("http://127.0.0.1:7441/ingest/6430476e-9d36-400f-ba65-8018f53bec18", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8dc679" },
            body: JSON.stringify({
                sessionId: "8dc679",
                location: "chat-sidebar.tsx:deleteTargetId-effect",
                message: "deleteTargetId state changed",
                data: { deleteTargetId, modalOpen: Boolean(deleteTargetId) },
                timestamp: Date.now(),
                hypothesisId: "H2",
            }),
        }).catch(() => {});
    }, [deleteTargetId]);
    // #endregion

    return (
        <div
            className={cn(
                "border-r bg-muted/10 transition-all duration-300 flex min-h-0 shrink-0 flex-col overflow-hidden",
                sidebarOpen ? "w-64 min-w-64 max-w-64" : "w-0 min-w-0 max-w-0",
            )}
        >
            {sidebarOpen ? (
                <>
                    <div className="p-4 border-b flex items-center justify-between">
                        <h2 className="font-semibold text-sm">Conversations</h2>
                        <Button size="sm" variant="ghost" onClick={onNewThread} disabled={isCreatingThread || disableNewThread} className="h-8 w-8 p-0">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <ScrollArea className="min-h-0 flex-1">
                        <div className="w-full space-y-1 p-2">
                            {deleteError ? <p className="px-3 py-1 text-xs text-destructive">{deleteError}</p> : null}
                            {threads?.map((thread) => (
                                <div
                                    key={thread._id}
                                    className={cn(
                                        "grid w-full grid-cols-[16px_minmax(0,1fr)_24px] items-center gap-2 overflow-hidden rounded-md px-3 py-2 transition-colors hover:bg-accent",
                                        thread._id === threadId ? "bg-accent" : "",
                                    )}
                                    onClick={() => {
                                        // #region agent log
                                        fetch("http://127.0.0.1:7441/ingest/6430476e-9d36-400f-ba65-8018f53bec18", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8dc679" },
                                            body: JSON.stringify({
                                                sessionId: "8dc679",
                                                location: "chat-sidebar.tsx:row-click",
                                                message: "session row clicked (onThreadSelect)",
                                                data: { threadId: thread._id },
                                                timestamp: Date.now(),
                                                hypothesisId: "H3",
                                            }),
                                        }).catch(() => {});
                                        // #endregion
                                        onThreadSelect(thread._id);
                                    }}
                                >
                                    <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                    <div className="min-w-0 flex-1 overflow-hidden pr-1">
                                        <span className="block truncate text-sm">{thread.title || "New Chat"}</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 shrink-0 p-0 text-muted-foreground/80 hover:bg-destructive/20 hover:text-destructive"
                                        onClick={(event) => {
                                            // #region agent log
                                            fetch("http://127.0.0.1:7441/ingest/6430476e-9d36-400f-ba65-8018f53bec18", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8dc679" },
                                                body: JSON.stringify({
                                                    sessionId: "8dc679",
                                                    location: "chat-sidebar.tsx:trash-click",
                                                    message: "trash button clicked",
                                                    data: { threadId: thread._id },
                                                    timestamp: Date.now(),
                                                    hypothesisId: "H1",
                                                }),
                                            }).catch(() => {});
                                            // #endregion
                                            event.stopPropagation();
                                            setDeleteError("");
                                            setDeleteTargetId(thread._id);
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
            <AlertDialog
                open={Boolean(deleteTargetId)}
                onOpenChange={(open) => {
                    if (!open && !isDeleting) {
                        setDeleteTargetId(null);
                    }
                }}
            >
                <AlertDialogContent className="z-[3001]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently removes the selected chat session and its transcript.
                            {deleteTarget ? ` (${deleteTarget.title || deleteTarget._id})` : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isDeleting || !deleteTargetId}
                            onClick={async (event) => {
                                // #region agent log
                                fetch("http://127.0.0.1:7441/ingest/6430476e-9d36-400f-ba65-8018f53bec18", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8dc679" },
                                    body: JSON.stringify({
                                        sessionId: "8dc679",
                                        location: "chat-sidebar.tsx:confirm-delete-click",
                                        message: "Delete confirm button clicked",
                                        data: { deleteTargetId, isDeleting },
                                        timestamp: Date.now(),
                                        hypothesisId: "H4",
                                    }),
                                }).catch(() => {});
                                // #endregion
                                event.preventDefault();
                                if (!deleteTargetId || isDeleting) return;
                                setIsDeleting(true);
                                const result = await onDeleteChat(deleteTargetId);
                                setIsDeleting(false);
                                if (result.ok) {
                                    setDeleteTargetId(null);
                                    return;
                                }
                                setDeleteError(result.error ?? "Failed to delete session.");
                            }}
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

