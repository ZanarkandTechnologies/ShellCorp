import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useChatStore, type LocalChatMessage } from "@/features/chat-system/chat-store";
import { useChatContext, useChatThreads, useChatMessages } from "@/features/chat-system/hooks";
import { ChatSidebar } from "@/features/chat-system/components/chat-sidebar";
import { ChatHeader } from "@/features/chat-system/components/chat-header";
import { MessageRenderer } from "@/features/chat-system/components/message-renderer";
import { ChatInput } from "@/features/chat-system/components/chat-input";
import { StoryChatPanel } from "@/features/chat-system/components/story-chat-panel";
import { Sparkles } from "lucide-react";
import { UI_Z } from "@/lib/z-index";

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
  const showWorkingOutput = useChatStore((state) => state.showWorkingOutput);
  const setShowWorkingOutput = useChatStore((state) => state.setShowWorkingOutput);
  const presentationMode = useChatStore((state) => state.presentationMode);
  const setPresentationMode = useChatStore((state) => state.setPresentationMode);

  const { headerTitle, headerSubtitle, isEmployeeScopedChat, storyPersona } = useChatContext();
  const {
    threads,
    subthreadsMap,
    threadId,
    setThreadId,
    handleNewThread,
    handleDeleteThread,
    isCreatingThread,
    agents,
    selectedAgentId,
    setSelectedAgentId,
  } = useChatThreads();
  const { messages, handleSubmit, abort, submissionStatus, isStreaming, streamingText } =
    useChatMessages(threadId);
  const streamingMessage: LocalChatMessage | null = streamingText.trim()
    ? {
        key: `stream-${threadId ?? "chat"}`,
        role: "assistant",
        text: streamingText,
        createdAt: Date.now(),
      }
    : null;
  const stageMessages = streamingMessage ? [...messages, streamingMessage] : messages;
  const isStoryMode = presentationMode === "story";

  return (
    <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
      <DialogContent
        className={`${isStoryMode ? "!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 rounded-none border-none bg-transparent p-0 shadow-none" : "min-w-[80vw] max-w-none h-[85vh] p-0"} flex flex-col overflow-hidden gap-0 ${isStoryMode ? "text-stone-50" : "border-none shadow-2xl bg-background"}`}
        overlayClassName={isStoryMode ? "bg-black/18 backdrop-blur-[1px]" : undefined}
        showCloseButton={!isStoryMode}
        style={{ zIndex: UI_Z.chat }}
      >
        <DialogTitle className="sr-only">Chat with Agent</DialogTitle>
        <div
          className={`flex flex-1 h-full min-h-0 overflow-hidden ${isStoryMode ? "bg-transparent" : "bg-background"}`}
        >
          {!isStoryMode ? (
            <ChatSidebar
              threads={threads}
              subthreadsMap={subthreadsMap}
              threadId={threadId}
              onThreadSelect={setThreadId}
              onNewThread={handleNewThread}
              onDeleteChat={handleDeleteThread}
              sidebarOpen={sidebarOpen}
              isCreatingThread={isCreatingThread}
              disableNewThread={isEmployeeScopedChat}
            />
          ) : null}
          <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            <ChatHeader
              sidebarOpen={sidebarOpen}
              onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
              title={headerTitle}
              subtitle={headerSubtitle}
              showWorkingOutput={showWorkingOutput}
              onToggleWorkingOutput={() => setShowWorkingOutput(!showWorkingOutput)}
              presentationMode={presentationMode}
              onTogglePresentationMode={() =>
                setPresentationMode(isStoryMode ? "classic" : "story")
              }
              storyMode={isStoryMode}
              onClose={() => setIsChatOpen(false)}
            />
            {!isStoryMode && !isEmployeeScopedChat ? (
              <div
                className={`px-4 py-2 border-b ${isStoryMode ? "bg-stone-950/90 border-white/10" : "bg-background/80"}`}
              >
                <div className="container max-w-4xl mx-auto flex gap-2">
                  <select
                    className={`rounded-md border px-2 py-1 text-sm ${isStoryMode ? "border-white/10 bg-stone-900 text-stone-100" : "bg-background"}`}
                    value={selectedAgentId ?? ""}
                    onChange={(event) => setSelectedAgentId(event.target.value || null)}
                  >
                    <option value="">Select agent</option>
                    {agents.map((agent) => (
                      <option key={agent.agentId} value={agent.agentId}>
                        {agent.displayName} ({agent.agentId})
                      </option>
                    ))}
                  </select>
                  <select
                    className={`rounded-md border px-2 py-1 text-sm ${isStoryMode ? "border-white/10 bg-stone-900 text-stone-100" : "bg-background"}`}
                    value={threadId ?? ""}
                    onChange={(event) => {
                      if (event.target.value) setThreadId(event.target.value);
                    }}
                  >
                    <option value="">Select session</option>
                    {threads.map((thread) => (
                      <option key={thread._id} value={thread._id}>
                        {thread.title || thread._id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {isStoryMode ? (
                <StoryChatPanel
                  messages={stageMessages}
                  persona={storyPersona}
                  showWorkingOutput={showWorkingOutput}
                  isStreaming={isStreaming}
                  threadId={threadId || undefined}
                />
              ) : (
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
                    {streamingMessage ? (
                      <MessageRenderer
                        key={streamingMessage.key}
                        message={streamingMessage}
                        threadId={threadId || undefined}
                        isLatestMessage
                        isStreaming
                      />
                    ) : null}
                    {isStreaming && !streamingMessage ? (
                      <div className="mb-3 flex justify-start">
                        <div className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                          Assistant is thinking...
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
            <ChatInput
              onSubmit={handleSubmit}
              onAbort={abort}
              submissionStatus={submissionStatus}
              isStreaming={isStreaming}
              variant={isStoryMode ? "story" : "classic"}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
