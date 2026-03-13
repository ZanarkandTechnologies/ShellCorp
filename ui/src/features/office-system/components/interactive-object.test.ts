import { describe, expect, it } from "vitest";

import { getBuilderClickAction } from "./interactive-object";

describe("interactive object builder click logic", () => {
  it("opens config on repeat click when settings are allowed", () => {
    expect(getBuilderClickAction({ isSelected: true, allowSettings: true })).toBe("open-config");
  });

  it("clears selection on repeat click when settings are disabled", () => {
    expect(getBuilderClickAction({ isSelected: true, allowSettings: false })).toBe(
      "clear-selection",
    );
  });

  it("selects the object on first click", () => {
    expect(getBuilderClickAction({ isSelected: false, allowSettings: false })).toBe("select");
  });
});
