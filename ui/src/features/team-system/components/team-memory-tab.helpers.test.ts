import { describe, expect, it } from "vitest";
import {
  describeTeamMemoryAuthor,
  formatTeamMemoryKindLabel,
} from "./team-memory-tab.helpers";

describe("team memory tab helpers", () => {
  it("formats memory kinds for UI badges", () => {
    expect(formatTeamMemoryKindLabel("handoff")).toBe("handoff");
    expect(formatTeamMemoryKindLabel("summary")).toBe("summary");
  });

  it("prefers semantic author labels", () => {
    expect(
      describeTeamMemoryAuthor({
        id: "mem-1",
        projectId: "proj-1",
        authorType: "operator",
        kind: "note",
        body: "Check the latest KPI drop.",
        createdAt: 1,
      }),
    ).toBe("Operator");

    expect(
      describeTeamMemoryAuthor({
        id: "mem-2",
        projectId: "proj-1",
        agentId: "alpha-builder",
        authorType: "agent",
        kind: "handoff",
        body: "Passing back to PM.",
        createdAt: 2,
      }),
    ).toBe("alpha-builder");
  });
});
