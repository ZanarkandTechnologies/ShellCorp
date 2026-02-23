import { describe, expect, it } from "vitest";
import { matchesWakeWord } from "./notion.js";

describe("notion wake words", () => {
  it("matches configured wake word case-insensitively", () => {
    expect(matchesWakeWord("Hey @Fahrenheit, check this", ["@fahrenheit"], true)).toBe(true);
  });

  it("rejects when wake word required and not present", () => {
    expect(matchesWakeWord("hey lester", ["@fahrenheit"], true)).toBe(false);
  });

  it("allows any content when wake word requirement is disabled", () => {
    expect(matchesWakeWord("hey lester", ["@fahrenheit"], false)).toBe(true);
  });
});
