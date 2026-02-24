import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { fahrenheitConfigSchema } from "../config/schema.js";
import type { CanonicalEntity, OntologyQueryResult } from "../types.js";
import { commitProofToMemory, runConnectorProof } from "./bootstrap.js";

const sampleRecord: CanonicalEntity = {
  id: "task-1",
  entityType: "task",
  title: "Ship connector bootstrap",
  status: "in_progress",
  source: {
    provider: "notion",
    workspace: "default",
    rawId: "raw-task-1",
  },
};

describe("connector bootstrap", () => {
  it("creates proof artifacts and transform preview", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "fahrenheit-bootstrap-"));
    const config = fahrenheitConfigSchema.parse({
      runtime: { workspaceDir: workspace },
      ontology: {
        enabled: true,
        connectors: {
          notion: {
            enabled: true,
            provider: "notion",
            apiKey: "test-key",
            projectTags: ["alpha"],
            roleTags: ["ops"],
          },
        },
      },
    });
    const ontologyService = {
      async execute(): Promise<OntologyQueryResult> {
        return {
          operation: "list",
          entityType: "task",
          confidence: 0.9,
          needsConfirmation: false,
          clarificationQuestions: [],
          records: [sampleRecord],
          notes: [],
        };
      },
    } as unknown as import("../ontology/service.js").OntologyService;

    const proof = await runConnectorProof(workspace, config, ontologyService, "notion");
    expect(proof.fetchedRecords.length).toBeGreaterThan(0);
    expect(proof.observationPreview.length).toBeGreaterThan(0);
    expect(proof.generatedSkillPath).toContain(path.join("skills", ".generated", "notion"));
  });

  it("gates commit by connector confidence threshold", async () => {
    const config = fahrenheitConfigSchema.parse({
      ontology: {
        enabled: true,
        connectors: {
          notion: {
            enabled: true,
            provider: "notion",
            bootstrap: {
              minConfidence: 0.9,
              allowGatedWrites: true,
            },
          },
        },
      },
    });
    const proof = {
      connectorId: "notion",
      fetchedRecords: [sampleRecord],
      observationPreview: [],
      generatedSkillPath: "x",
      evidencePath: "y",
      confidence: 0.5,
    };
    const calls: string[] = [];
    const pipeline = {
      async recordPollingRun(): Promise<void> {
        calls.push("called");
      },
    } as unknown as import("../memory/pipeline.js").ObservationalMemoryPipeline;

    const result = await commitProofToMemory(proof, pipeline, config, {
      projectId: "project-ops",
      groupId: "ops",
      sessionKey: "group:ops:main",
    });
    expect(result.blocked).toBe(true);
    expect(calls).toHaveLength(0);
  });
});
