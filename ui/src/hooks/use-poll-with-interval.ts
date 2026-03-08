"use client";

/**
 * USE POLL WITH INTERVAL
 * ======================
 * Encapsulates the setInterval + cancelled-flag teardown pattern that
 * appears in 6+ components (agent-session-panel, skills-panel, App.tsx,
 * office-data-provider, approval-queue, office-menu).
 *
 * KEY CONCEPTS:
 * - Calls `fn` immediately on mount, then repeats every `intervalMs`.
 * - Returns cleanup that both cancels in-flight async calls and clears the timer.
 * - `deps` must be primitives (per rerender-dependencies rule).
 *
 * USAGE:
 * - usePollWithInterval(async () => { await adapter.load(); setData(...); }, 10_000, [isOpen]);
 *
 * MEMORY REFERENCES:
 * - MEM-0144 refactor: Phase 2 hook extraction
 */
import { useEffect } from "react";

export function usePollWithInterval(
  fn: (signal: { cancelled: boolean }) => Promise<void> | void,
  intervalMs: number,
  deps: readonly unknown[],
): void {
  useEffect(() => {
    const signal = { cancelled: false };
    void Promise.resolve(fn(signal));
    const timer = setInterval(() => {
      if (!signal.cancelled) void Promise.resolve(fn(signal));
    }, intervalMs);
    return () => {
      signal.cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, intervalMs]);
}
