import { afterEach, describe, expect, it, vi } from "vitest";

import { beginObjectInteractionTrace, endObjectInteractionTrace } from "./object-interaction-perf";

describe("object interaction perf tracing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs start and ready phases without throwing", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    beginObjectInteractionTrace("builder-menu", "object-1", { source: "click" });
    endObjectInteractionTrace("builder-menu", "object-1", "ready", { actions: 6 });

    expect(debugSpy).toHaveBeenCalledTimes(2);
    expect(debugSpy.mock.calls[0][0]).toBe("[perf] builder-menu-start");
    expect(debugSpy.mock.calls[1][0]).toBe("[perf] builder-menu-ready");
  });

  it("allows ending a trace even if start was missed", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    endObjectInteractionTrace("builder-panel", "object-2", "cancelled");

    expect(debugSpy).toHaveBeenCalledWith("[perf] builder-panel-cancelled", expect.objectContaining({
      objectId: "object-2",
    }));
  });
});
