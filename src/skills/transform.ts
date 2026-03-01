/**
 * SKILL TRANSFORM PREVIEW
 * =======================
 * Converts fetched connector data into observational-memory previews.
 *
 * KEY CONCEPTS:
 * - Preview records must stay in observation contract format before commit.
 * - Partition tags are required to avoid context pollution across projects.
 * - Transform output is reviewable before any gated writes are applied.
 *
 * USAGE:
 * - Called by connector bootstrap prove/preview flows.
 *
 * MEMORY REFERENCES:
 * - MEM-0010
 * - MEM-0011
 */
import type { CanonicalEntity, ObservationEvent, ObservationTrustClass } from "../types.js";
import { normalizeObservation } from "../memory/observations.js";

export interface TransformPreviewInput {
  connectorId: string;
  projectId: string;
  groupId: string;
  sessionKey: string;
  projectTags: string[];
  roleTags: string[];
  trustClass: ObservationTrustClass;
  sourceRef: string;
  records: CanonicalEntity[];
}

export function toObservationPreview(input: TransformPreviewInput): ObservationEvent[] {
  const events: ObservationEvent[] = [];
  for (const record of input.records) {
    const summary = [
      `${record.entityType} "${record.title}"`,
      record.status ? `status=${record.status}` : "",
      record.owner ? `owner=${record.owner}` : "",
      record.summary ? `summary=${record.summary}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
    events.push(
      normalizeObservation({
        projectId: input.projectId,
        groupId: input.groupId,
        sessionKey: input.sessionKey,
        eventType: "workflow.delta",
        source: input.connectorId,
        sourceRef: record.source.rawId ?? input.sourceRef,
        projectTags: input.projectTags,
        roleTags: input.roleTags,
        summary,
        trustClass: input.trustClass,
        confidence: 0.8,
        metadata: {
          entityType: record.entityType,
          canonicalId: record.id,
        },
      }),
    );
  }
  return events;
}
