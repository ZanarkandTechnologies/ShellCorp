/**
 * STORY CHAT DISPLAY
 * ==================
 * Derives the portrait-driven story-chat stage state from the existing
 * chat transcript and employee context.
 *
 * KEY CONCEPTS:
 * - Story mode is presentational only; it reuses the current thread and message transport unchanged.
 * - The stage prioritizes the latest assistant dialogue while keeping backlog and working output inspectable.
 *
 * USAGE:
 * - `buildStoryChatView(...)` inside the experimental story chat layout.
 *
 * MEMORY REFERENCES:
 * - MEM-0107
 */

import type { LocalChatMessage } from "@/features/chat-system/chat-store";

export type StoryChatPersona = {
  displayName: string;
  subtitle?: string;
  avatarUrl?: string;
  emoji?: string;
  initials: string;
  statusLabel?: string;
  teamLabel?: string;
};

export type StoryChatView = {
  featuredMessage: LocalChatMessage | null;
  recentDialogue: LocalChatMessage[];
  workingOutput: LocalChatMessage[];
};

function isDialogueMessage(message: LocalChatMessage): boolean {
  return message.kind !== "working_output";
}

export function getDisplayInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "AG";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "AG";
}

export function buildStoryChatView(messages: LocalChatMessage[]): StoryChatView {
  const dialogueMessages = messages.filter(isDialogueMessage);
  const featuredMessage =
    [...dialogueMessages].reverse().find((message) => message.role === "assistant") ??
    dialogueMessages.at(-1) ??
    null;
  const recentDialogue = featuredMessage
    ? dialogueMessages.filter((message) => message.key !== featuredMessage.key).slice(-4)
    : dialogueMessages.slice(-4);
  const workingOutput = messages.filter((message) => message.kind === "working_output");

  return {
    featuredMessage,
    recentDialogue,
    workingOutput,
  };
}
