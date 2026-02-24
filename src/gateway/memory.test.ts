import { describe, expect, it } from "vitest";

import { buildMemoryStats, filterObservations } from "./server.js";
import type { ObservationEvent } from "../types.js";

function observation(overrides: Partial<ObservationEvent> = {}): ObservationEvent {
  return {
    id: "obs-1",
    projectId: "project-alpha",
    groupId: "alpha",
    sessionKey: "group:alpha:main",
    eventType: "workflow.delta",
    source: "notion",
    sourceRef: "page-1",
    occurredAt: new Date().toISOString(),
    projectTags: ["alpha"],
    roleTags: ["ops"],
    summary: "Task blocked by dependency",
    confidence: 0.8,
    trustClass: "trusted",
    status: "accepted",
    category: "blocker_risk",
    rationale: "Derived from blocker marker.",
    provenanceRefs: ["page-1"],
    signals: [{ type: "blocker", label: "blocker marker", confidence: 0.8 }],
    ...overrides,
  };
}

describe("memory view helpers", () => {
  it("filters observations by source/project/trust/signal", () => {
    const rows: ObservationEvent[] = [
      observation({ id: "1", source: "notion", trustClass: "trusted", projectTags: ["alpha"] }),
      observation({
        id: "2",
        source: "slack",
        trustClass: "system",
        projectTags: ["beta"],
        signals: [{ type: "risk", label: "risk marker", confidence: 0.7 }],
      }),
    ];

    const filtered = filterObservations(rows, {
      projectId: "project-alpha",
      source: "slack",
      projectTag: "beta",
      trustClass: "system",
      signalType: "risk",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("2");
  });

  it("builds aggregated memory stats for ceo cards", () => {
    const now = Date.now();
    const rows: ObservationEvent[] = [
      observation({
        id: "1",
        trustClass: "trusted",
        occurredAt: new Date(now - 10 * 60 * 1000).toISOString(),
      }),
      observation({
        id: "2",
        trustClass: "system",
        occurredAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        signals: [{ type: "upsell", label: "upsell", confidence: 0.9 }],
      }),
      observation({
        id: "3",
        trustClass: "untrusted",
        occurredAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
        signals: [{ type: "improvement", label: "improve", confidence: 0.5 }],
      }),
    ];

    const stats = buildMemoryStats(rows, now);
    expect(stats.totalObservations).toBe(3);
    expect(stats.pendingReview).toBe(0);
    expect(stats.byTrustClass.trusted).toBe(1);
    expect(stats.byTrustClass.system).toBe(1);
    expect(stats.byTrustClass.untrusted).toBe(1);
    expect(stats.bySignalType.blocker).toBe(1);
    expect(stats.bySignalType.upsell).toBe(1);
    expect(stats.bySignalType.improvement).toBe(1);
    expect(stats.recentActivity.last24h).toBe(1);
    expect(stats.recentActivity.last7d).toBe(2);
  });
});
