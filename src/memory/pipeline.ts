/**
 * OBSERVATIONAL MEMORY PIPELINE
 * =============================
 * Bridges gateway/router/scheduler events into structured observational memory.
 *
 * KEY CONCEPTS:
 * - Records workflow deltas from observational ingress and polling runs.
 * - Applies trust-based auto-promotion into MEMORY.md.
 * - Runs bounded compression with replay-safe snapshots.
 *
 * USAGE:
 * - recordInboundObservation for observational channel events.
 * - recordPollingRun for scheduled provider polling traces.
 * - runCompression for heartbeat-driven maintenance.
 *
 * MEMORY REFERENCES:
 * - MEM-0006
 * - MEM-0010
 */
import path from "node:path";

import type { CronRunLog, InboundEnvelope, ObservationTrustClass } from "../types.js";
import type { MemoryCompressionOptions, MemoryPromotionPolicy } from "./store.js";
import { MemoryStore } from "./store.js";

export interface ObservationIngestPayload {
  envelope: InboundEnvelope;
  groupId: string;
  sessionKey: string;
  correlationId: string;
}

export interface PollingObservationPayload {
  source: string;
  sourceRef: string;
  summary: string;
  projectTags?: string[];
  roleTags?: string[];
  trustClass?: ObservationTrustClass;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface ObservationalMemoryConfig {
  promotion: MemoryPromotionPolicy;
  compression: MemoryCompressionOptions;
}

function toTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

export class ObservationalMemoryPipeline {
  constructor(
    private readonly memoryStore: MemoryStore,
    private readonly config: ObservationalMemoryConfig,
  ) {}

  async recordInboundObservation(payload: ObservationIngestPayload): Promise<void> {
    const metadata = payload.envelope.raw && typeof payload.envelope.raw === "object"
      ? payload.envelope.raw as Record<string, unknown>
      : {};
    const confidence = typeof metadata.confidence === "number" ? metadata.confidence : 0.75;
    const trustClass = metadata.trustClass === "system" || metadata.trustClass === "untrusted" ? metadata.trustClass : "trusted";
    const projectTags = toTags(metadata.projectTags);
    if (projectTags.length === 0) projectTags.push(payload.groupId);
    const roleTags = toTags(metadata.roleTags);
    if (roleTags.length === 0) roleTags.push("operator");

    await this.memoryStore.appendObservation(
      {
        eventType: "workflow.delta",
        source: payload.envelope.channelId,
        sourceRef: payload.envelope.threadId ?? payload.envelope.sourceId,
        occurredAt: new Date(payload.envelope.timestamp).toISOString(),
        projectTags,
        roleTags,
        workflowStage: typeof metadata.workflowStage === "string" ? metadata.workflowStage : undefined,
        decisionRef: typeof metadata.decisionRef === "string" ? metadata.decisionRef : undefined,
        summary: payload.envelope.content,
        confidence,
        trustClass,
        metadata: {
          correlationId: payload.correlationId,
          senderId: payload.envelope.senderId,
          sessionKey: payload.sessionKey,
        },
      },
      this.config.promotion,
    );
  }

  async recordPollingRun(run: CronRunLog & { elapsedMs?: number }, payload: PollingObservationPayload): Promise<void> {
    await this.memoryStore.appendObservation(
      {
        eventType: "polling.delta",
        source: payload.source,
        sourceRef: payload.sourceRef,
        occurredAt: new Date(run.ts).toISOString(),
        projectTags: payload.projectTags,
        roleTags: payload.roleTags,
        workflowStage: "polling",
        summary: payload.summary,
        confidence: payload.confidence ?? 0.8,
        trustClass: payload.trustClass ?? "system",
        metadata: {
          ...(payload.metadata ?? {}),
          jobId: run.jobId,
          runStatus: run.status,
          correlationId: run.correlationId,
          elapsedMs: run.elapsedMs,
        },
      },
      this.config.promotion,
    );
  }

  async runCompression(): Promise<void> {
    await this.memoryStore.compressHistoryIfNeeded({
      ...this.config.compression,
      snapshotDir: path.resolve(this.config.compression.snapshotDir),
    });
  }
}
