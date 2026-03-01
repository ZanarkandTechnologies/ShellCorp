import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { fahrenheitConfigSchema } from "../config/schema.js";
import { discoverConnectorSources, proposeConnectorOnboarding } from "./bootstrap.js";

describe("connector onboarding flow", () => {
  it("supports deterministic source discovery override", async () => {
    const config = fahrenheitConfigSchema.parse({
      ontology: {
        enabled: true,
        connectors: {
          notion: {
            enabled: true,
            provider: "notion",
            apiKey: "test",
          },
        },
      },
    });
    const discovery = await discoverConnectorSources(config, "notion", {
      sourcesOverride: [
        { id: "2", title: "zeta", objectType: "data_source" },
        { id: "1", title: "alpha", objectType: "data_source" },
      ],
    });
    expect(discovery.sources.map((source) => source.title)).toEqual(["alpha", "zeta"]);
  });

  it("builds mapping proposals with confidence and unresolved list", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "fahrenheit-onboarding-"));
    const config = fahrenheitConfigSchema.parse({
      runtime: { workspaceDir: workspace },
      ontology: {
        enabled: true,
        connectors: {
          notion: {
            enabled: true,
            provider: "notion",
            apiKey: "test",
            entities: {
              task: { databaseNameHint: "tasks" },
              project: { databaseNameHint: "projects" },
              goal: { databaseNameHint: "goals" },
              crmRecord: { databaseNameHint: "crm opportunities" },
            },
          },
        },
      },
    });
    const proposal = await proposeConnectorOnboarding(workspace, config, "notion", undefined, {
      sourcesOverride: [
        { id: "db-task", title: "Tasks", objectType: "data_source" },
        { id: "db-project", title: "Projects", objectType: "data_source" },
        { id: "db-goal", title: "Goals", objectType: "data_source" },
      ],
    });
    expect(proposal.mappingProposals).toHaveLength(4);
    const taskMapping = proposal.mappingProposals.find((mapping) => mapping.entityType === "task");
    expect(taskMapping?.databaseId).toBe("db-task");
    const unresolved = new Set(proposal.unresolved);
    expect(unresolved.has("crmRecord")).toBe(true);
    expect(proposal.generatedSkillPath).toContain(path.join("skills", ".generated", "notion"));
  });
});
