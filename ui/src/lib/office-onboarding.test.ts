import { beforeEach, describe, expect, it } from "vitest";

import {
  advanceOfficeOnboardingStep,
  getOfficeOnboardingCompleted,
  parseOfficeOnboardingSeed,
  setOfficeOnboardingCompleted,
  shouldShowOfficeOnboarding,
} from "./office-onboarding";

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.has(key) ? values.get(key) ?? null : null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

describe("office onboarding helpers", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage();
  });

  it("reads the onboarding seed from company config", () => {
    expect(
      parseOfficeOnboardingSeed({
        ui: {
          onboarding: { enabled: true, completed: false },
        },
      }),
    ).toEqual({ enabled: true, completed: false });
  });

  it("shows onboarding only when enabled and not locally completed", () => {
    const seed = { ui: { onboarding: { enabled: true, completed: false } } };
    expect(shouldShowOfficeOnboarding(seed, storage)).toBe(true);

    setOfficeOnboardingCompleted(true, storage);

    expect(getOfficeOnboardingCompleted(storage)).toBe(true);
    expect(shouldShowOfficeOnboarding(seed, storage)).toBe(false);
  });

  it("does not show onboarding when company config marks it completed", () => {
    expect(
      shouldShowOfficeOnboarding(
        { ui: { onboarding: { enabled: true, completed: true } } },
        storage,
      ),
    ).toBe(false);
  });

  it("advances the onboarding state machine only on matching signals", () => {
    expect(advanceOfficeOnboardingStep("click-ceo", "ceo-selected")).toBe("open-chat");
    expect(advanceOfficeOnboardingStep("open-chat", "chat-opened")).toBe("open-shop");
    expect(advanceOfficeOnboardingStep("open-shop", "shop-opened")).toBe("open-team");
    expect(advanceOfficeOnboardingStep("open-team", "team-opened")).toBe(null);
    expect(advanceOfficeOnboardingStep("open-chat", "shop-opened")).toBe("open-chat");
  });
});
