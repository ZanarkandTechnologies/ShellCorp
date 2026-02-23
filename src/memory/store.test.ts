import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { MemoryStore } from "./store.js";

describe("MemoryStore observational pipeline", () => {
  it("writes structured observations and auto-promotes trusted/system entries", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "fahrenheit-memory-"));
    const store = new MemoryStore(workspace);

    const first = await store.appendObservation({
      eventType: "workflow.delta",
      source: "notion",
      sourceRef: "page:123",
      summary: "Task is blocked by an external dependency",
      trustClass: "trusted",
      projectTags: ["Project-Alpha"],
      roleTags: ["Ops"],
    });
    const second = await store.appendObservation({
      eventType: "workflow.delta",
      source: "slack",
      sourceRef: "channel:C1",
      summary: "Potential upsell path discovered in customer thread",
      trustClass: "system",
      projectTags: ["project-alpha"],
      roleTags: ["sales"],
    });

    expect(first.promotion.promoted).toBe(true);
    expect(first.promotion.promotionClass).toBe("warning");
    expect(second.promotion.promoted).toBe(true);
    expect(second.promotion.promotionClass).toBe("operational");

    const history = await store.readHistory();
    expect(history).toContain("OBSERVATION");
    expect(history).toContain("\"source\":\"notion\"");
    expect(history).toContain("\"source\":\"slack\"");

    const memory = await store.readMemory();
    expect(memory).toContain("source=notion");
    expect(memory).toContain("source=slack");
    expect(memory).toContain("signals=blocker");
    expect(memory).toContain("signals=upsell");
  });

  it("keeps untrusted entries in history unless explicitly allowed", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "fahrenheit-memory-policy-"));
    const store = new MemoryStore(workspace);

    const result = await store.appendObservation(
      {
        eventType: "workflow.delta",
        source: "slack",
        sourceRef: "channel:C2",
        summary: "Unverified note from external source",
        trustClass: "untrusted",
      },
      { autoPromoteTrust: ["trusted", "system"] },
    );
    expect(result.promotion.promoted).toBe(false);
    expect(result.promotion.reason).toContain("trust_requires_approval");

    const memory = await store.readMemory();
    expect(memory).toBe("");
  });

  it("compresses history only when age and threshold conditions are met", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "fahrenheit-memory-compress-"));
    const store = new MemoryStore(workspace);
    const snapshotDir = path.join(workspace, ".memory", "history-snapshots");

    for (let i = 0; i < 12; i += 1) {
      await store.appendObservation({
        eventType: "workflow.delta",
        source: "notion",
        sourceRef: `page:${i}`,
        summary: `observation ${i}`,
        trustClass: "trusted",
      });
    }

    const early = await store.compressHistoryIfNeeded({
      maxLines: 10,
      maxBytes: 64,
      minAgeMinutes: 60,
      keepLastLines: 5,
      snapshotDir,
    });
    expect(early.compressed).toBe(false);
    expect(early.reason).toBe("below_min_age");

    const compressed = await store.compressHistoryIfNeeded({
      maxLines: 10,
      maxBytes: 64,
      minAgeMinutes: 0,
      keepLastLines: 5,
      snapshotDir,
    });
    expect(compressed.compressed).toBe(true);
    expect(compressed.snapshotPath).toBeDefined();

    const remaining = (await store.readHistory()).split(/\r?\n/).filter(Boolean);
    expect(remaining.length).toBeLessThanOrEqual(5);
  });
});
