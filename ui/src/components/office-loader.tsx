/**
 * OFFICE LOADER
 * =============
 * Bootstrap overlay for the office scene.
 *
 * KEY CONCEPTS:
 * - This module owns only the loading overlay presentation; bootstrap state lives in
 *   `office-bootstrap.ts` and `office-simulation.tsx`.
 * - The loader stays centered, but it must still read like the rest of ShellCorp's
 *   square-edged material HUD instead of inventing a separate visual language.
 * - Bootstrap stages render as wrapped status cards so long detail copy stays readable
 *   without truncation.
 *
 * USAGE:
 * - Render while `bootstrapState.isReady` is false in `office-simulation.tsx`
 * - Pass ordered bootstrap stages from `buildOfficeBootstrapStages`
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 * - MEM-0160
 */

import { Loader } from "@/components/ai-elements/loader";

import type { OfficeBootstrapStage } from "./office-bootstrap";

type OfficeLoaderProps = {
  completionRatio: number;
  stages: OfficeBootstrapStage[];
};

export function OfficeLoader({ completionRatio, stages }: OfficeLoaderProps): React.JSX.Element {
  const activeStage = stages.find((stage) => !stage.isReady) ?? stages[stages.length - 1];
  const completionPercent = Math.round(completionRatio * 100);

  return (
    <div className="absolute inset-0 z-[120] flex items-center justify-center bg-background/92 backdrop-blur-md">
      <div className="w-full max-w-5xl px-6 py-10">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 border border-border bg-background/95 px-6 py-8 text-center shadow-2xl md:px-10 md:py-10">
          <div className="relative flex h-28 w-28 items-center justify-center border border-border bg-card">
            <div className="absolute inset-3 border border-border" />
            <div className="absolute inset-0 animate-spin border-t-2 border-primary" />
            <div className="flex h-16 w-16 items-center justify-center border border-border bg-background text-lg font-semibold tracking-[0.24em] text-primary">
              SC
            </div>
          </div>

          <div className="relative flex max-w-2xl flex-col items-center gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.34em] text-muted-foreground">
              ShellCorp
            </p>
            <h2 className="text-3xl font-semibold tracking-[0.08em] text-foreground sm:text-4xl">
              Loading office
            </h2>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              {activeStage?.detail}
            </p>
          </div>

          <div className="relative w-full max-w-2xl space-y-4">
            <div className="overflow-hidden border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                <span>Bootstrap progress</span>
                <span>{completionPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden border border-border bg-muted">
                <div
                  className="h-full bg-primary transition-[width] duration-300 ease-out"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <div className="mt-3 text-sm text-muted-foreground">{activeStage?.label}</div>
            </div>
          </div>

          <div className="relative grid w-full max-w-4xl gap-3 md:grid-cols-3">
            {stages.map((stage) => (
              <div
                key={stage.id}
                className="flex min-h-36 flex-col items-center justify-start gap-3 border border-border bg-card px-4 py-5 text-center"
              >
                {/* Keep stage cards on shared HUD surfaces so centering does not drift from the material theme. */}
                <div className="flex h-9 w-9 items-center justify-center border border-border bg-background">
                  {stage.isReady ? (
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  ) : (
                    <Loader className="text-primary" size={14} />
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold tracking-[0.08em] text-foreground">
                    {stage.label}
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">{stage.detail}</p>
                </div>
                <div className="mt-auto text-[11px] uppercase tracking-[0.22em] text-muted-foreground/90">
                  {stage.isReady ? "Ready" : "In progress"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
