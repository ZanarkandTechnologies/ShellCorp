import { describe, expect, it } from "vitest";
import {
  coerceActivityEventType,
  coerceBoardActorType,
  coerceBoardEventType,
  coerceBoardTaskPriority,
  coerceBoardTaskStatus,
} from "./board_contract";

describe("board_contract", () => {
  it("coerces task status and priority enums", () => {
    expect(coerceBoardTaskStatus("todo")).toBe("todo");
    expect(coerceBoardTaskStatus("done")).toBe("done");
    expect(coerceBoardTaskStatus("unknown")).toBeUndefined();

    expect(coerceBoardTaskPriority("low")).toBe("low");
    expect(coerceBoardTaskPriority("high")).toBe("high");
    expect(coerceBoardTaskPriority("urgent")).toBeUndefined();
  });

  it("coerces board event and actor enums", () => {
    expect(coerceBoardEventType("task_created")).toBe("task_created");
    expect(coerceBoardEventType("task_updated")).toBe("task_updated");
    expect(coerceBoardEventType("task_deleted")).toBe("task_deleted");
    expect(coerceBoardEventType("task_reopened")).toBe("task_reopened");
    expect(coerceBoardEventType("wat")).toBeUndefined();

    expect(coerceBoardActorType("agent")).toBe("agent");
    expect(coerceBoardActorType("operator")).toBe("operator");
    expect(coerceBoardActorType("nope")).toBeUndefined();
  });

  it("coerces activity event enum", () => {
    expect(coerceActivityEventType("executing")).toBe("executing");
    expect(coerceActivityEventType("summary")).toBe("summary");
    expect(coerceActivityEventType("invalid")).toBeUndefined();
  });
});
