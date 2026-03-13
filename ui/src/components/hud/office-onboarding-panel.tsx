"use client";

/**
 * OFFICE ONBOARDING PANEL
 * =======================
 * First-run overlay that teaches the core office interaction loop through real clicks.
 *
 * KEY CONCEPTS:
 * - Progress follows real UI actions: CEO click, CEO chat, office shop, team workspace
 * - `/company.json` decides whether the seeded office shows onboarding at all
 * - Local completion suppresses repeat prompts without mutating the seed file
 *
 * USAGE:
 * - Mount once from `office-simulation.tsx`
 *
 * MEMORY REFERENCES:
 * - MEM-0109
 * - MEM-0164
 */

import { useEffect, useMemo, useState } from "react";
import { MessageSquare, ShoppingBag, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useChatStore } from "@/features/chat-system/chat-store";
import { useAppStore } from "@/lib/app-store";
import { UI_Z } from "@/lib/z-index";
import {
  advanceOfficeOnboardingStep,
  setOfficeOnboardingCompleted,
  shouldShowOfficeOnboarding,
  type OfficeOnboardingStep,
} from "@/lib/office-onboarding";
import { useOfficeDataContext } from "@/providers/office-data-provider";

type SeedConfig = {
  ui?: {
    onboarding?: {
      enabled?: boolean;
      completed?: boolean;
    };
  };
};

type StepCopy = {
  eyebrow: string;
  title: string;
  body: string;
  icon: typeof MessageSquare;
  prompt?: string;
};

const STEP_COPY: Record<OfficeOnboardingStep, StepCopy> = {
  "click-ceo": {
    eyebrow: "Step 1 of 4",
    title: "Start with the CEO",
    body: "Click the CEO agent in the office. That is the fastest way to learn the ShellCorp control loop.",
    icon: MessageSquare,
  },
  "open-chat": {
    eyebrow: "Step 2 of 4",
    title: "Ask the CEO to build a team",
    body: "Use the radial Chat action, then tell the CEO what goal you want. The point of the AI Office is that you ask for the outcome and the agent uses ShellCorp for you.",
    icon: MessageSquare,
    prompt: 'Create a dedicated team to grow our affiliate revenue, and have them focus only on that goal.',
  },
  "open-shop": {
    eyebrow: "Step 3 of 4",
    title: "Decorate the office",
    body: "Use the top-left menu and open Decoration. You can place furniture yourself or ask the agent to help decorate.",
    icon: ShoppingBag,
  },
  "open-team": {
    eyebrow: "Step 4 of 4",
    title: "Review the spawned team",
    body: "Open Team Workspace from the same menu to inspect the goal-focused team and watch their work from the office UI.",
    icon: Users,
  },
};

export function OfficeOnboardingPanel(): React.JSX.Element | null {
  const { employees } = useOfficeDataContext();
  const selectedObjectId = useAppStore((state) => state.selectedObjectId);
  const isFurnitureShopOpen = useAppStore((state) => state.isFurnitureShopOpen);
  const isGlobalTeamPanelOpen = useAppStore((state) => state.isGlobalTeamPanelOpen);
  const isCeoWorkbenchOpen = useAppStore((state) => state.isCeoWorkbenchOpen);
  const isOfficeOnboardingVisible = useAppStore((state) => state.isOfficeOnboardingVisible);
  const setIsOfficeOnboardingVisible = useAppStore((state) => state.setIsOfficeOnboardingVisible);
  const officeOnboardingStep = useAppStore((state) => state.officeOnboardingStep);
  const setOfficeOnboardingStep = useAppStore((state) => state.setOfficeOnboardingStep);
  const isChatOpen = useChatStore((state) => state.isChatOpen);
  const currentEmployeeId = useChatStore((state) => state.currentEmployeeId);
  const [isConfigReady, setIsConfigReady] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const onboardingEmployeeId = useMemo(
    () => employees.find((employee) => employee.isCEO)?._id ?? "employee-main",
    [employees],
  );
  const expectedSelectedObjectIds = useMemo(
    () => [onboardingEmployeeId, `employee-${onboardingEmployeeId}`],
    [onboardingEmployeeId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadConfig(): Promise<void> {
      try {
        const response = await fetch("/company.json");
        const payload = (await response.json()) as SeedConfig;
        if (cancelled) return;
        const shouldShow = shouldShowOfficeOnboarding(payload);
        setConfigError(null);
        setIsOfficeOnboardingVisible(shouldShow);
        setOfficeOnboardingStep(shouldShow ? "click-ceo" : null);
      } catch (error) {
        if (!cancelled) {
          console.warn("[office-onboarding] failed to load /company.json", error);
          setConfigError("Onboarding config could not be loaded from /company.json.");
          setIsOfficeOnboardingVisible(false);
          setOfficeOnboardingStep(null);
        }
      } finally {
        if (!cancelled) setIsConfigReady(true);
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, [setIsOfficeOnboardingVisible, setOfficeOnboardingStep]);

  useEffect(() => {
    if (!isOfficeOnboardingVisible || officeOnboardingStep !== "click-ceo") return;
    if (selectedObjectId && expectedSelectedObjectIds.includes(selectedObjectId)) {
      setOfficeOnboardingStep(advanceOfficeOnboardingStep(officeOnboardingStep, "ceo-selected"));
    }
  }, [
    expectedSelectedObjectIds,
    isOfficeOnboardingVisible,
    officeOnboardingStep,
    selectedObjectId,
    setOfficeOnboardingStep,
  ]);

  useEffect(() => {
    if (!isOfficeOnboardingVisible || officeOnboardingStep !== "open-chat") return;
    if (isChatOpen && currentEmployeeId === onboardingEmployeeId) {
      setOfficeOnboardingStep(advanceOfficeOnboardingStep(officeOnboardingStep, "chat-opened"));
    }
  }, [
    currentEmployeeId,
    isChatOpen,
    isOfficeOnboardingVisible,
    onboardingEmployeeId,
    officeOnboardingStep,
    setOfficeOnboardingStep,
  ]);

  useEffect(() => {
    if (!isOfficeOnboardingVisible || officeOnboardingStep !== "open-shop") return;
    if (isFurnitureShopOpen) {
      setOfficeOnboardingStep(advanceOfficeOnboardingStep(officeOnboardingStep, "shop-opened"));
    }
  }, [
    isFurnitureShopOpen,
    isOfficeOnboardingVisible,
    officeOnboardingStep,
    setOfficeOnboardingStep,
  ]);

  useEffect(() => {
    if (!isOfficeOnboardingVisible || officeOnboardingStep !== "open-team") return;
    if (isGlobalTeamPanelOpen || isCeoWorkbenchOpen) {
      const nextStep = advanceOfficeOnboardingStep(officeOnboardingStep, "team-opened");
      setOfficeOnboardingCompleted(true);
      setIsOfficeOnboardingVisible(false);
      setOfficeOnboardingStep(nextStep);
    }
  }, [
    isCeoWorkbenchOpen,
    isGlobalTeamPanelOpen,
    isOfficeOnboardingVisible,
    officeOnboardingStep,
    setIsOfficeOnboardingVisible,
    setOfficeOnboardingStep,
  ]);

  const step = useMemo(() => {
    if (!officeOnboardingStep) return null;
    return STEP_COPY[officeOnboardingStep];
  }, [officeOnboardingStep]);

  function handleSkip(): void {
    setOfficeOnboardingCompleted(true);
    setConfigError(null);
    setIsOfficeOnboardingVisible(false);
    setOfficeOnboardingStep(null);
  }

  const actionLabel = officeOnboardingStep === "open-team" ? "Done" : "Skip tour";

  if (!isConfigReady) return null;

  if (configError) {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4"
        style={{ zIndex: UI_Z.onboarding }}
      >
        <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-amber-500/30 bg-background/95 p-4 shadow-2xl backdrop-blur">
          <p className="text-sm font-semibold text-foreground">Office onboarding unavailable</p>
          <p className="mt-2 text-sm text-muted-foreground">{configError}</p>
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isOfficeOnboardingVisible || !step) return null;

  const Icon = step.icon;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4"
      style={{ zIndex: UI_Z.onboarding }}
    >
      <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-primary/30 bg-background/95 p-4 shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/12 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {step.eyebrow}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
            {step.prompt ? (
              <div className="mt-3 rounded-lg border border-primary/20 bg-primary/8 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                  Try this prompt
                </p>
                <p className="mt-1 text-sm text-foreground">{step.prompt}</p>
              </div>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">
              ShellCorp is the UI. The agent can use the CLI for you.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Progress updates when you actually click the live controls.
          </div>
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
