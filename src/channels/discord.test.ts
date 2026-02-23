import { describe, expect, it } from "vitest";
import { describeDiscordThreadError, getDiscordThreadDecisionReason } from "./discord.js";

describe("discord thread error formatting", () => {
  it("formats missing permissions as compact readable output", () => {
    const value = describeDiscordThreadError("discord_thread_create_failed", "C1", "M1", 50013, "Missing Permissions");
    expect(value).toContain("missing_permissions");
  });

  it("formats thread limit errors as thread_limit_reached", () => {
    const value = describeDiscordThreadError("discord_thread_create_failed", "C1", "M1", 160006, "Limit");
    expect(value).toContain("thread_limit_reached");
  });

  it("includes fallback message details for unknown codes", () => {
    const value = describeDiscordThreadError("discord_thread_create_failed", "C1", "M1", 99999, "Some failure");
    expect(value).toContain("Some failure");
  });
});

describe("discord thread decision reasons", () => {
  it("requires mention and reply context to create thread", () => {
    expect(getDiscordThreadDecisionReason(false, true, true)).toBe("create_thread");
    expect(getDiscordThreadDecisionReason(false, false, true)).toBe("not_mentioned");
    expect(getDiscordThreadDecisionReason(false, true, false)).toBe("missing_reply_context");
  });

  it("skips thread creation when already in thread", () => {
    expect(getDiscordThreadDecisionReason(true, true, true)).toBe("thread_present");
  });
});
