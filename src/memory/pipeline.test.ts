import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ObservationalMemoryPipeline } from "./pipeline.js";
import { MemoryStore } from "./store.js";

describe("ObservationalMemoryPipeline", () => {
  it("records Notion+Slack polling runs as delta observations with promotion", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "fahrenheit-memory-pipeline-"));
    const pipeline = new ObservationalMemoryPipeline(new MemoryStore(workspace), {
      promotion: { autoPromoteTrust: ["trusted", "system"] },
      compression: {
        maxLines: 5000,
        maxBytes: 5_000_000,
        minAgeMinutes: 60,
        keepLastLines: 400,
        snapshotDir: path.join(workspace, ".memory", "history-snapshots"),
      },
    });

    await pipeline.recordPollingRun(
      {
        ts: Date.now(),
        jobId: "ontology-poll:notion",
        status: "ok",
        detail: "Job executed",
        correlationId: "cron:notion",
      },
      {
        projectId: "project-alpha",
        groupId: "alpha",
        sessionKey: "group:alpha:main",
        source: "notion",
        sourceRef: "ontology.connectors.notion",
        summary: "Blocked task waiting on legal review",
        projectTags: ["alpha"],
        roleTags: ["ops"],
      },
    );

    await pipeline.recordPollingRun(
      {
        ts: Date.now(),
        jobId: "ontology-poll:slack",
        status: "ok",
        detail: "Job executed",
        correlationId: "cron:slack",
      },
      {
        projectId: "project-alpha",
        groupId: "alpha",
        sessionKey: "group:alpha:main",
        source: "slack",
        sourceRef: "ontology.connectors.slack",
        summary: "Customer thread suggests upsell opportunity",
        projectTags: ["alpha"],
        roleTags: ["sales"],
      },
    );

    const store = new MemoryStore(workspace);
    const observations = await store.listObservations(50);
    expect(observations).toHaveLength(2);
    expect(observations.map((event) => event.source).sort()).toEqual(["notion", "slack"]);
    expect(observations[0]?.eventType).toBe("polling.delta");

    const memory = await store.readMemory();
    expect(memory).toContain("source=notion");
    expect(memory).toContain("source=slack");
    expect(memory).toContain("signals=blocker");
    expect(memory).toContain("signals=upsell");
  });
});
