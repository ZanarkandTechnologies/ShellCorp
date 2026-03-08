/**
 * CONVEX SHARED UTILITIES
 * =======================
 * Pure helpers reused across board.ts, status.ts, and events.ts.
 *
 * KEY CONCEPTS:
 * - Zero Convex-runtime dependencies (no ctx, no db, no v)
 * - All functions are deterministic and side-effect-free
 *
 * MEMORY REFERENCES:
 * - MEM-0144 refactor: DRY extraction from 3 convex modules
 */

export function trimOrUndefined(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeTeamId(value?: string): string | undefined {
  const trimmed = trimOrUndefined(value);
  return trimmed ? trimmed.toLowerCase() : undefined;
}

export function nowMs(value?: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Date.now();
}
