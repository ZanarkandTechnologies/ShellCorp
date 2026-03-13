import { describe, expect, it } from "vitest";

import { collectTaskMemoryLinks, parseTaskMemory } from "./sc12-task-memory";

describe("sc12 task memory helpers", () => {
  it("parses markdown headings and bullets into sections", () => {
    const parsed = parseTaskMemory(
      [
        "# Goal",
        "Ship the CEO board preview.",
        "",
        "# Next Step",
        "- Add mock tasks",
        "- Render markdown-ish notes",
      ].join("\n"),
    );

    expect(parsed.sections).toEqual([
      {
        title: "Goal",
        paragraphs: ["Ship the CEO board preview."],
        bullets: [],
      },
      {
        title: "Next Step",
        paragraphs: [],
        bullets: ["Add mock tasks", "Render markdown-ish notes"],
      },
    ]);
  });

  it("captures colon-style sections and collects links", () => {
    const parsed = parseTaskMemory(
      [
        "Goal: Validate the board-native task memory view.",
        "",
        "Links:",
        "- https://example.com/brief",
        "- https://example.com/session",
      ].join("\n"),
    );

    expect(parsed.sections[0]).toEqual({
      title: "Goal",
      paragraphs: ["Validate the board-native task memory view."],
      bullets: [],
    });
    expect(parsed.sections[1].title).toBe("Links");
    expect(parsed.links).toEqual(["https://example.com/brief", "https://example.com/session"]);
  });

  it("extracts unique links from free-form notes", () => {
    expect(
      collectTaskMemoryLinks(
        "Use https://example.com/brief and https://example.com/brief before opening https://example.com/run.",
      ),
    ).toEqual(["https://example.com/brief", "https://example.com/run"]);
  });
});
