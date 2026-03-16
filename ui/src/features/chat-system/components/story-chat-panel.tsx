"use client";

/**
 * STORY CHAT PANEL
 * ================
 * Minimal consult HUD layered over the live office scene while the
 * camera focuses on the active employee.
 *
 * KEY CONCEPTS:
 * - The employee in the 3D scene is the character; the HUD should stay light.
 * - Story mode keeps only a small top strip, optional working output, and the dialogue box.
 *
 * USAGE:
 * - Rendered by `ChatDialog` when `presentationMode === "story"`.
 *
 * MEMORY REFERENCES:
 * - MEM-0107
 * - MEM-0160
 */

import type { LocalChatMessage } from "@/features/chat-system/chat-store";
import { MessageRenderer } from "@/features/chat-system/components/message-renderer";
import {
  buildStoryChatView,
  type StoryChatPersona,
} from "@/features/chat-system/story-chat-display";
import { Sparkles } from "lucide-react";

type StoryChatPanelProps = {
  messages: LocalChatMessage[];
  persona: StoryChatPersona;
  showWorkingOutput: boolean;
  isStreaming: boolean;
  threadId?: string;
};

function formatRoleLabel(message: LocalChatMessage | null, persona: StoryChatPersona): string {
  if (!message) return persona.displayName;
  if (message.role === "user") return "You";
  return persona.displayName;
}

export function StoryChatPanel({
  messages,
  persona,
  showWorkingOutput,
  isStreaming,
  threadId,
}: StoryChatPanelProps) {
  const { featuredMessage, recentDialogue, workingOutput } = buildStoryChatView(messages);
  const roleLabel = formatRoleLabel(featuredMessage, persona);
  const previousLine = recentDialogue.at(-1) ?? null;

  return (
    <div className="pointer-events-none relative h-full overflow-hidden">
      <div className="absolute inset-x-6 top-5 flex items-start justify-between gap-4">
        <div className="pointer-events-auto border border-border/70 bg-background/95 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Consulting: {persona.displayName}
        </div>
        <div className="pointer-events-auto border border-border/70 bg-background/95 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {persona.subtitle || persona.teamLabel || "Direct channel"}
        </div>
      </div>

      {showWorkingOutput ? (
        <div className="pointer-events-auto absolute right-6 top-20 z-20 hidden min-w-[260px] w-[min(24vw,320px)] border border-border/70 bg-background/95 p-3 lg:block">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Working Output
            </div>
            {isStreaming ? (
              <div className="inline-flex items-center gap-2 text-[10px] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                Live
              </div>
            ) : null}
          </div>
          <div className="max-h-[42vh] space-y-3 overflow-y-auto pr-1">
            {workingOutput.length > 0 ? (
              workingOutput.map((message) => (
                <MessageRenderer key={message.key} message={message} threadId={threadId} />
              ))
            ) : (
              <div className="border border-border/70 bg-muted/40 px-3 py-4 text-[11px] text-muted-foreground">
                No working output for this scene yet.
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8">
        {previousLine ? (
          <div className="pointer-events-none mb-2 ml-3 max-w-[min(42vw,520px)] border border-border/70 bg-background/95 px-3 py-2 text-[9px] text-muted-foreground">
            <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {previousLine.role === "user" ? "Previous: You" : `Previous: ${persona.displayName}`}
            </div>
            <div className="line-clamp-2 whitespace-pre-wrap leading-4">{previousLine.text}</div>
          </div>
        ) : null}

        <div className="pointer-events-auto relative mx-auto max-w-[min(72vw,1120px)] border border-border/70 bg-background/95 px-3 pb-3 pt-3">
          <div className="absolute inset-0 bg-muted/10" />
          <div className="absolute left-3 top-0 -translate-y-1/2 border border-border/70 bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-foreground">
            {roleLabel}
          </div>
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {featuredMessage ? (
                <div className="max-h-[2.75rem] overflow-y-auto pr-2">
                  <p className="whitespace-pre-wrap text-[10px] leading-[1.35] text-foreground sm:text-[11px]">
                    {featuredMessage.text}
                  </p>
                </div>
              ) : (
                <div className="py-4 text-center text-[10px] text-muted-foreground">
                  The scene is waiting for the first line.
                </div>
              )}
            </div>
            <div className="hidden shrink-0 items-center gap-2 border border-border/70 bg-muted px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground md:inline-flex">
              {featuredMessage?.role === "user" ? "Founder" : "Agent"}
              {isStreaming ? (
                <>
                  <span className="text-muted-foreground/50">|</span>
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
