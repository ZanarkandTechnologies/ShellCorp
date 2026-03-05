import { describe, expect, it } from "vitest";
import { parseBoardCommandPayload, parseBoardQueryPayload } from "./board_http_contract";

describe("board_http_contract", () => {
  it("parses board command payload", () => {
    const parsed = parseBoardCommandPayload({
      teamId: "team-proj-affiliate",
      projectId: "proj-affiliate",
      command: "task_add",
      title: "Draft hook",
      priority: "high",
      beatId: "beat-42",
    });
    expect(parsed?.teamId).toBe("team-proj-affiliate");
    expect(parsed?.projectId).toBe("proj-affiliate");
    expect(parsed?.command).toBe("task_add");
    expect(parsed?.title).toBe("Draft hook");
    expect(parsed?.priority).toBe("high");
    expect(parsed?.beatId).toBe("beat-42");
  });

  it("rejects invalid board command payload", () => {
    expect(parseBoardCommandPayload({ command: "task_add" })).toBeNull();
  });

  it("parses board query payload", () => {
    const parsed = parseBoardQueryPayload({
      teamId: "team-proj-affiliate",
      projectId: "proj-affiliate",
      query: "activity",
      limit: 20,
    });
    expect(parsed).toEqual({
      teamId: "team-proj-affiliate",
      projectId: "proj-affiliate",
      query: "activity",
      limit: 20,
    });
  });

  it("rejects unknown board query type", () => {
    expect(parseBoardQueryPayload({ projectId: "proj-affiliate", query: "unknown" })).toBeNull();
  });
});

