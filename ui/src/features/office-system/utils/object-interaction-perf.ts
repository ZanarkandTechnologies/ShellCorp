/**
 * OBJECT INTERACTION PERF
 * =======================
 * Development-only instrumentation for office object click/menu/panel latency.
 *
 * KEY CONCEPTS:
 * - Builder interactions should have a single obvious outcome per click path
 * - Perf tracing is dev-only and should never affect production behavior
 * - Traces are keyed by interaction kind + object id so menu/panel readiness can be correlated
 *
 * USAGE:
 * - `beginObjectInteractionTrace("builder-menu", objectId, {...})`
 * - `endObjectInteractionTrace("builder-menu", objectId, "ready", {...})`
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 */

type InteractionTraceKind = "builder-menu" | "builder-panel" | "runtime-panel";

const traceStarts = new Map<string, number>();

function getNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function buildTraceKey(kind: InteractionTraceKind, objectId: string): string {
  return `${kind}:${objectId}`;
}

export function beginObjectInteractionTrace(
  kind: InteractionTraceKind,
  objectId: string,
  extra?: Record<string, unknown>,
): void {
  if (!import.meta.env.DEV) return;
  const key = buildTraceKey(kind, objectId);
  const startedAtMs = getNow();
  traceStarts.set(key, startedAtMs);
  console.debug(`[perf] ${kind}-start`, {
    objectId,
    startedAtMs,
    ...extra,
  });
}

export function endObjectInteractionTrace(
  kind: InteractionTraceKind,
  objectId: string,
  phase: "ready" | "cancelled",
  extra?: Record<string, unknown>,
): void {
  if (!import.meta.env.DEV) return;
  const key = buildTraceKey(kind, objectId);
  const startedAtMs = traceStarts.get(key);
  const now = getNow();
  console.debug(`[perf] ${kind}-${phase}`, {
    objectId,
    latencyMs: startedAtMs == null ? undefined : Math.round(now - startedAtMs),
    ...extra,
  });
  traceStarts.delete(key);
}
