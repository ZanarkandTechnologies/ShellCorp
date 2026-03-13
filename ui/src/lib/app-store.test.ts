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

  it("stores Skill Studio selection context", () => {
    useAppStore.getState().setSelectedSkillStudioSkillId("create-team");
    useAppStore.getState().setSkillStudioFocusAgentId("main");
    expect(useAppStore.getState().selectedSkillStudioSkillId).toBe("create-team");
    expect(useAppStore.getState().skillStudioFocusAgentId).toBe("main");
  });

  it("stores builder transform target", () => {
    useAppStore.getState().setActiveObjectTransformId("plant-1" as never);
    expect(useAppStore.getState().activeObjectTransformId).toBe("plant-1");
  });

  it("stores office onboarding state", () => {
    useAppStore.getState().setIsOfficeOnboardingVisible(true);
    useAppStore.getState().setOfficeOnboardingStep("open-shop");
    useAppStore.getState().setIsFurnitureShopOpen(true);

    expect(useAppStore.getState().isOfficeOnboardingVisible).toBe(true);
    expect(useAppStore.getState().officeOnboardingStep).toBe("open-shop");
    expect(useAppStore.getState().isFurnitureShopOpen).toBe(true);
  });
});
