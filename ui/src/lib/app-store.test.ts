import { beforeEach, describe, expect, it } from "vitest";

import { type ActiveObjectPanelState, useAppStore } from "./app-store";

const initialState = useAppStore.getInitialState();

function buildPanel(openedAtMs: number): ActiveObjectPanelState {
  return {
    objectId: "object-world-monitor" as ActiveObjectPanelState["objectId"],
    title: "World Monitor",
    url: "https://www.worldmonitor.app/",
    displayName: "Globe",
    aspectRatio: "wide",
    openedAtMs,
  };
}

describe("app store perf guards", () => {
  beforeEach(() => {
    useAppStore.setState(initialState, true);
  });

  it("keeps the same state object when selectedObjectId is unchanged", () => {
    const before = useAppStore.getState();
    before.setSelectedObjectId(null);
    expect(useAppStore.getState()).toBe(before);
  });

  it("keeps the same state object when activeObjectPanel is unchanged", () => {
    useAppStore.getState().setActiveObjectPanel(buildPanel(100));
    const before = useAppStore.getState();
    before.setActiveObjectPanel(buildPanel(100));
    expect(useAppStore.getState()).toBe(before);
  });
});
