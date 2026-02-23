/**
 * OBSERVATIONAL MEMORY CONTRACT
 * =============================
 * Normalizes raw observational events into structured memory records.
 *
 * KEY CONCEPTS:
 * - Observation events capture workflow deltas, not full source-system clones.
 * - Source trust controls auto-promotion into durable memory.
 * - Signal extraction tags blockers, risks, upsell, and improvement opportunities.
 *
 * USAGE:
 * - Build normalized events from gateway intake and polling runs.
 * - Serialize observations into HISTORY.md with stable parseable lines.
 * - Derive promotion classes before writing MEMORY.md.
 *
 * MEMORY REFERENCES:
 * - MEM-0006
 * - MEM-0010
 */
import { randomUUID } from "node:crypto";

import type {
  MemoryPromotionClass,
  ObservationEvent,
  ObservationSignal,
  ObservationSignalType,
  ObservationTrustClass,
} from "../types.js";

const OBSERVATION_PREFIX = "- OBSERVATION ";

const signalKeywords: Record<ObservationSignalType, string[]> = {
  blocker: ["blocked", "waiting", "stuck", "dependency", "cannot proceed", "hold"],
  risk: ["risk", "slip", "delay", "late", "issue", "regression", "incident"],
  upsell: ["upsell", "expansion", "upgrade", "add-on", "cross-sell"],
  improvement: ["improve", "optimize", "cleanup", "reduce", "faster", "automate"],
};

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number(value.toFixed(3));
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  for (const rawTag of tags) {
    const normalized = rawTag.trim().toLowerCase();
    if (!normalized) continue;
    seen.add(normalized);
  }
  return [...seen];
}

export function deriveSignals(summary: string, baselineConfidence: number): ObservationSignal[] {
  const text = summary.toLowerCase();
  const signals: ObservationSignal[] = [];
  for (const [type, keywords] of Object.entries(signalKeywords) as Array<[ObservationSignalType, string[]]>) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      signals.push({
        type,
        label: `${type} marker`,
        confidence: clampConfidence(baselineConfidence),
        details: summary.slice(0, 240),
      });
    }
  }
  return signals;
}

export interface NormalizeObservationInput {
  id?: string;
  eventType: string;
  source: string;
  sourceRef: string;
  occurredAt?: string;
  projectTags?: string[];
  roleTags?: string[];
  workflowStage?: string;
  decisionRef?: string;
  summary: string;
  confidence?: number;
  trustClass: ObservationTrustClass;
  signals?: ObservationSignal[];
  metadata?: Record<string, unknown>;
}

export function normalizeObservation(input: NormalizeObservationInput): ObservationEvent {
  const confidence = clampConfidence(input.confidence ?? 0.75);
  const summary = input.summary.trim();
  const baseSignals = input.signals ?? deriveSignals(summary, confidence);
  return {
    id: input.id ?? randomUUID(),
    eventType: input.eventType.trim() || "workflow.delta",
    source: input.source.trim(),
    sourceRef: input.sourceRef.trim(),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    projectTags: normalizeTags(input.projectTags),
    roleTags: normalizeTags(input.roleTags),
    workflowStage: input.workflowStage?.trim() || undefined,
    decisionRef: input.decisionRef?.trim() || undefined,
    summary,
    confidence,
    trustClass: input.trustClass,
    signals: baseSignals.map((signal) => ({
      ...signal,
      confidence: clampConfidence(signal.confidence),
    })),
    metadata: input.metadata,
  };
}

export function toHistoryLine(event: ObservationEvent): string {
  return `${OBSERVATION_PREFIX}${JSON.stringify(event)}`;
}

export function parseHistoryLine(line: string): ObservationEvent | null {
  if (!line.startsWith(OBSERVATION_PREFIX)) return null;
  const payload = line.slice(OBSERVATION_PREFIX.length);
  try {
    const parsed = JSON.parse(payload) as ObservationEvent;
    return normalizeObservation(parsed);
  } catch {
    return null;
  }
}

export function choosePromotionClass(event: ObservationEvent): MemoryPromotionClass {
  if (event.signals.some((signal) => signal.type === "blocker" || signal.type === "risk")) {
    return "warning";
  }
  if (event.signals.some((signal) => signal.type === "upsell" || signal.type === "improvement")) {
    return "operational";
  }
  return "informational";
}

export function formatMemoryEntry(event: ObservationEvent, promotionClass: MemoryPromotionClass): string {
  const signalSummary = event.signals.map((signal) => signal.type).join(",");
  const projectScope = event.projectTags.length > 0 ? event.projectTags.join(",") : "unscoped";
  const roleScope = event.roleTags.length > 0 ? event.roleTags.join(",") : "unscoped";
  return [
    `${event.occurredAt} | ${promotionClass} | source=${event.source}`,
    `trust=${event.trustClass}`,
    `project=${projectScope}`,
    `role=${roleScope}`,
    `signals=${signalSummary || "none"}`,
    `summary=${event.summary}`,
    `ref=${event.sourceRef}`,
  ].join(" | ");
}

export function canAutoPromote(event: ObservationEvent, allowedTrust: ObservationTrustClass[]): boolean {
  return allowedTrust.includes(event.trustClass);
}

export function isObservationHistoryLine(line: string): boolean {
  return line.startsWith(OBSERVATION_PREFIX);
}
