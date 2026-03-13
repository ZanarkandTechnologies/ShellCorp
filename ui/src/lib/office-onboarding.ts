"use client";

/**
 * OFFICE ONBOARDING
 * =================
 * UI-only first-run onboarding helpers for the office experience.
 *
 * KEY CONCEPTS:
 * - Public `/company.json` can enable the onboarding flow for a seeded office demo
 * - Local completion is stored in browser storage so refreshes do not replay the tour
 * - Step progression is driven by real UI interactions, not a fake slideshow
 *
 * USAGE:
 * - Read `/company.json`, then call `shouldShowOfficeOnboarding`
 * - Persist completion with `setOfficeOnboardingCompleted`
 *
 * MEMORY REFERENCES:
 * - MEM-0109
 * - MEM-0164
 */

export type OfficeOnboardingStep = "click-ceo" | "open-chat" | "open-shop" | "open-team";
export type OfficeOnboardingSignal = "ceo-selected" | "chat-opened" | "shop-opened" | "team-opened";

export const OFFICE_ONBOARDING_STORAGE_KEY = "shellcorp.office-onboarding.completed";

type CompanySeedOnboarding = {
  enabled?: boolean;
  completed?: boolean;
};

type CompanySeedUi = {
  onboarding?: CompanySeedOnboarding;
};

type CompanySeed = {
  ui?: CompanySeedUi;
};

function getStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function parseOfficeOnboardingSeed(value: unknown): CompanySeedOnboarding | null {
  if (!value || typeof value !== "object") return null;
  const ui = "ui" in value && value.ui && typeof value.ui === "object" ? (value.ui as CompanySeedUi) : null;
  const onboarding =
    ui && ui.onboarding && typeof ui.onboarding === "object" ? ui.onboarding : null;
  return onboarding ?? null;
}

export function shouldShowOfficeOnboarding(value: unknown, storage?: Storage | null): boolean {
  const onboarding = parseOfficeOnboardingSeed(value);
  if (!onboarding?.enabled || onboarding.completed === true) return false;
  return !getOfficeOnboardingCompleted(storage);
}

export function getOfficeOnboardingCompleted(storage?: Storage | null): boolean {
  const resolved = getStorage(storage);
  if (!resolved) return false;
  return resolved.getItem(OFFICE_ONBOARDING_STORAGE_KEY) === "true";
}

export function setOfficeOnboardingCompleted(
  completed: boolean,
  storage?: Storage | null,
): void {
  const resolved = getStorage(storage);
  if (!resolved) return;
  if (!completed) {
    resolved.removeItem(OFFICE_ONBOARDING_STORAGE_KEY);
    return;
  }
  resolved.setItem(OFFICE_ONBOARDING_STORAGE_KEY, "true");
}

export function advanceOfficeOnboardingStep(
  step: OfficeOnboardingStep | null,
  signal: OfficeOnboardingSignal,
): OfficeOnboardingStep | null {
  if (step === "click-ceo" && signal === "ceo-selected") return "open-chat";
  if (step === "open-chat" && signal === "chat-opened") return "open-shop";
  if (step === "open-shop" && signal === "shop-opened") return "open-team";
  if (step === "open-team" && signal === "team-opened") return null;
  return step;
}
