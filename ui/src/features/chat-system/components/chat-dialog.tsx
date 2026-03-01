import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useChatStore } from "@/features/chat-system/chat-store";
import { useChatContext, useChatThreads, useChatMessages } from "@/features/chat-system/hooks";
import { ChatSidebar } from "@/features/chat-system/components/chat-sidebar";
import { ChatHeader } from "@/features/chat-system/components/chat-header";
import { MessageRenderer } from "@/features/chat-system/components/message-renderer";
import { ChatInput } from "@/features/chat-system/components/chat-input";

/**
 * CHAT DIALOG
 * ===========
 * Zanarkand-parity chat modal shell for ShellCorp.
 */
export default function ChatDialog() {
    const isChatOpen = useChatStore((state) => state.isChatOpen);
    const setIsChatOpen = useChatStore((state) => state.setIsChatOpen);
    const sidebarOpen = useChatStore((state) => state.sidebarOpen);
    const setSidebarOpen = useChatStore((state) => state.setSidebarOpen);

    const { headerTitle, headerSubtitle } = useChatContext();
    const {
        threads,
        subthreadsMap,
        threadId,
        setThreadId,
        handleNewThread,
        handleDeleteThread,
        isCreatingThread,
    } = useChatThreads();
    const { messages, handleSubmit, submissionStatus, isStreaming } = useChatMessages(threadId);

    return (
        <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
            <DialogContent className="min-w-[80vw] max-w-none h-[85vh] p-0 flex flex-col overflow-hidden gap-0 border-none shadow-2xl bg-background z-[2000]">
                <DialogTitle className="sr-only">Chat with Agent</DialogTitle>
                <div className="flex flex-1 h-full overflow-hidden bg-background">
                    <ChatSidebar
                        threads={threads}
                        subthreadsMap={subthreadsMap}
                        threadId={threadId}
                        onThreadSelect={setThreadId}
                        onNewThread={handleNewThread}
                        onDeleteChat={handleDeleteThread}
                        sidebarOpen={sidebarOpen}
                        isCreatingThread={isCreatingThread}
                    />
                    <div className="flex flex-col flex-1 h-full overflow-hidden relative">
                        <ChatHeader
                            sidebarOpen={sidebarOpen}
                            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                            title={headerTitle}
                            subtitle={headerSubtitle}
                        />
                        <div className="flex-1 overflow-hidden relative">
                            <div className="h-full overflow-y-auto">
                                <div className="container max-w-4xl mx-auto px-4 pb-4">
                                    {!messages || messages.length === 0 ? (
                                        <div className="flex items-center justify-center h-full min-h-[200px]">
                                            <div className="text-center text-muted-foreground">
                                                <p className="text-lg font-medium mb-2">Start a conversation</p>
                                                <p className="text-sm">Ask me to research anything!</p>
                                            </div>
                                        </div>
                                    ) : (
                                        messages.map((message, index) => (
                                            <MessageRenderer
                                                key={message.key || String(index)}
                                                message={message}
                                                threadId={threadId || undefined}
                                                isLatestMessage={index === messages.length - 1}
                                                isStreaming={isStreaming}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                        <ChatInput onSubmit={handleSubmit} submissionStatus={submissionStatus} />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

