import { describe, expect, it } from "vitest";
import { inferOntologyMapping } from "./mapping.js";
import { fahrenheitConfigSchema, type FahrenheitConfig } from "../config/schema.js";

function baseConfig(): FahrenheitConfig {
  return fahrenheitConfigSchema.parse({
    ontology: {
      enabled: true,
      writeMinConfidence: 0.85,
      connectors: {
        notion: {
          enabled: true,
          workspaceName: "acme",
          description: "Tasks: Product Tasks DB\nProjects: Product Roadmap DB\nGoals: Quarterly OKRs\nCRM: Sales Pipeline",
          apiKey: "test",
          entities: {
            task: {},
            project: {},
            goal: {},
            crmRecord: {},
          },
          polling: {
            enabled: false,
          },
        },
      },
    },
  });
}

describe("inferOntologyMapping", () => {
  it("infers database hints from text descriptions", () => {
    const mapping = inferOntologyMapping(baseConfig());
    expect(mapping.entities.task.databaseNameHint).toContain("Product Tasks");
    expect(mapping.entities.project.databaseNameHint).toContain("Product Roadmap");
    expect(mapping.entities.goal.databaseNameHint).toContain("Quarterly OKRs");
    expect(mapping.entities.crmRecord.databaseNameHint).toContain("Sales Pipeline");
    expect(mapping.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("creates clarification questions when mappings are missing", () => {
    const config = baseConfig();
    config.ontology.connectors.notion.description = "";
    const mapping = inferOntologyMapping(config);
    expect(mapping.clarificationQuestions.length).toBeGreaterThan(0);
    expect(mapping.confidence).toBeLessThan(0.5);
  });
});
