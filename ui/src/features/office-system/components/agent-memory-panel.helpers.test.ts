import { describe, expect, it } from "vitest";

import type { AgentFileEntry, AgentMemoryEntry } from "@/lib/openclaw-types";

import {
  buildAgentMemoryFileGroups,
  getDefaultAgentMemoryFileName,
  getRawMemoryPreviewText,
  isAgentMemoryFileName,
  toUserFacingMemoryPanelError,
} from "./agent-memory-panel.helpers";

const FILES: AgentFileEntry[] = [
  { name: "README.md", path: "/tmp/agent/README.md", missing: false },
  { name: "memory/research.md", path: "/tmp/agent/memory/research.md", missing: false },
  { name: "MEMORY.md", path: "/tmp/agent/MEMORY.md", missing: false },
];

const ENTRIES: AgentMemoryEntry[] = [
  {
    id: "mem-1",
    agentId: "agent",
    source: { sourcePath: "/tmp/agent/memory/research.md", lineNumber: 4 },
    rawText: "raw 1",
    text: "Research finding",
    ts: 200,
    tags: ["research"],
    type: "discovery",
  },
  {
    id: "mem-2",
    agentId: "agent",
    source: { sourcePath: "/tmp/agent/MEMORY.md", lineNumber: 12 },
    rawText: "raw 2",
    text: "Durable decision",
    ts: 300,
    memId: "MEM-2000",
    tags: ["decision"],
    type: "decision",
  },
];

describe("agent memory panel helpers", () => {
  it("recognizes canonical memory file names", () => {
    expect(isAgentMemoryFileName("MEMORY.md")).toBe(true);
    expect(isAgentMemoryFileName("memory/research.md")).toBe(true);
    expect(isAgentMemoryFileName("README.md")).toBe(false);
  });

  it("groups parsed entries by normalized source file and sorts MEMORY first", () => {
    const groups = buildAgentMemoryFileGroups({
      entries: ENTRIES,
      files: FILES,
    });

    expect(groups.map((group) => group.fileName)).toEqual(["MEMORY.md", "memory/research.md"]);
    expect(groups[0]?.entries[0]?.memId).toBe("MEM-2000");
    expect(groups[1]?.file?.name).toBe("memory/research.md");
  });

  it("retains memory files that have no parsed entries yet", () => {
    const groups = buildAgentMemoryFileGroups({
      entries: [],
      files: FILES,
    });

    expect(groups.map((group) => group.fileName)).toEqual(["MEMORY.md", "memory/research.md"]);
    expect(groups[0]?.entries).toEqual([]);
    expect(getDefaultAgentMemoryFileName(groups)).toBe("MEMORY.md");
  });

  it("maps internal load failures to user-facing copy", () => {
    expect(toUserFacingMemoryPanelError("memory_entries_load_failed", "entries")).toBe(
      "Unable to load parsed memory entries right now.",
    );
    expect(toUserFacingMemoryPanelError("file_load_failed", "files")).toBe(
      "Unable to load the selected memory file right now.",
    );
  });

  it("builds raw preview copy without nested panel logic", () => {
    const [activeGroup] = buildAgentMemoryFileGroups({
      entries: ENTRIES,
      files: FILES,
    });

    expect(
      getRawMemoryPreviewText({
        activeGroup: null,
        activeRawContent: "",
      }),
    ).toBe("Select a memory file to inspect raw content.");

    expect(
      getRawMemoryPreviewText({
        activeGroup: activeGroup ?? null,
        activeRawContent: "",
      }),
    ).toBe("File is empty.");
  });
});
