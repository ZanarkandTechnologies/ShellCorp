import { describe, expect, it } from "vitest";
import { buildStoryChatView, getDisplayInitials } from "./story-chat-display";
import type { LocalChatMessage } from "./chat-store";

function createMessage(
  partial: Partial<LocalChatMessage> &
    Pick<LocalChatMessage, "key" | "role" | "text" | "createdAt">,
): LocalChatMessage {
  return {
    kind: "default",
    ...partial,
  };
}

describe("story chat display", () => {
  it("prefers the latest assistant dialogue as the featured stage message", () => {
    const messages: LocalChatMessage[] = [
      createMessage({ key: "user-1", role: "user", text: "Hey.", createdAt: 1 }),
      createMessage({ key: "assistant-1", role: "assistant", text: "Hello there.", createdAt: 2 }),
      createMessage({
        key: "tool-1",
        role: "assistant",
        text: "[tool:start] search",
        createdAt: 3,
        kind: "working_output",
      }),
      createMessage({
        key: "assistant-2",
        role: "assistant",
        text: "I found three paths.",
        createdAt: 4,
      }),
    ];

    const view = buildStoryChatView(messages);

    expect(view.featuredMessage?.key).toBe("assistant-2");
    expect(view.recentDialogue.map((message) => message.key)).toEqual(["user-1", "assistant-1"]);
    expect(view.workingOutput.map((message) => message.key)).toEqual(["tool-1"]);
  });

  it("falls back to the latest non-working-output message when no assistant reply exists", () => {
    const view = buildStoryChatView([
      createMessage({ key: "user-1", role: "user", text: "Need help", createdAt: 1 }),
      createMessage({
        key: "tool-1",
        role: "assistant",
        text: "[tool:start] search",
        createdAt: 2,
        kind: "working_output",
      }),
    ]);

    expect(view.featuredMessage?.key).toBe("user-1");
    expect(view.recentDialogue).toHaveLength(0);
  });

  it("builds stable initials for portrait fallback", () => {
    expect(getDisplayInitials("Shell Operator")).toBe("SO");
    expect(getDisplayInitials("zan")).toBe("Z");
    expect(getDisplayInitials("")).toBe("AG");
  });
});
