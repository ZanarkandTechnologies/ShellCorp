import { describe, expect, it } from "vitest";
import { parseBoardCommandPayload, parseBoardQueryPayload } from "./board_http_contract";

describe("board_http_contract", () => {
  it("parses board command payload", () => {
    const parsed = parseBoardCommandPayload({
      projectId: "proj-affiliate",
      command: "task_add",
      title: "Draft hook",
      priority: "high",
    });
    expect(parsed?.projectId).toBe("proj-affiliate");
    expect(parsed?.command).toBe("task_add");
    expect(parsed?.title).toBe("Draft hook");
    expect(parsed?.priority).toBe("high");
  });

  it("rejects invalid board command payload", () => {
    expect(parseBoardCommandPayload({ command: "task_add" })).toBeNull();
  });

  it("parses board query payload", () => {
    const parsed = parseBoardQueryPayload({
      projectId: "proj-affiliate",
      query: "activity",
      limit: 20,
    });
    expect(parsed).toEqual({
      projectId: "proj-affiliate",
      query: "activity",
      limit: 20,
    });
  });

  it("rejects unknown board query type", () => {
    expect(parseBoardQueryPayload({ projectId: "proj-affiliate", query: "unknown" })).toBeNull();
  });
});

