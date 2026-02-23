import { describe, expect, it } from "vitest";
import { fahrenheitConfigSchema, type FahrenheitConfig } from "../config/schema.js";
import type { CanonicalEntity, OntologyEntityType, OntologyQueryRequest } from "../types.js";
import type { OntologyProviderAdapter, ProviderOperationContext } from "../providers/base.js";
import { OntologyService } from "./service.js";

class FakeAdapter implements OntologyProviderAdapter {
  readonly providerId = "fake";

  async list(entityType: OntologyEntityType, _request: OntologyQueryRequest, context: ProviderOperationContext): Promise<CanonicalEntity[]> {
    return [this.record(entityType, "list-record", context)];
  }

  async get(entityType: OntologyEntityType, request: OntologyQueryRequest, context: ProviderOperationContext): Promise<CanonicalEntity[]> {
    return [this.record(entityType, request.id ?? "missing-id", context)];
  }

  async create(entityType: OntologyEntityType, request: OntologyQueryRequest, context: ProviderOperationContext): Promise<CanonicalEntity[]> {
    return [this.record(entityType, String(request.payload?.title ?? "created"), context)];
  }

  async update(entityType: OntologyEntityType, request: OntologyQueryRequest, context: ProviderOperationContext): Promise<CanonicalEntity[]> {
    return [this.record(entityType, request.id ?? "updated", context)];
  }

  async search(entityType: OntologyEntityType, _request: OntologyQueryRequest, context: ProviderOperationContext): Promise<CanonicalEntity[]> {
    return [this.record(entityType, "search-record", context)];
  }

  private record(entityType: OntologyEntityType, title: string, context: ProviderOperationContext): CanonicalEntity {
    return {
      id: "r1",
      entityType,
      title,
      source: {
        provider: "fake",
        workspace: context.workspaceName,
      },
    };
  }
}

function configWithConfidence(description: string, writeMinConfidence = 0.85): FahrenheitConfig {
  return fahrenheitConfigSchema.parse({
    ontology: {
      enabled: true,
      writeMinConfidence,
      connectors: {
        notion: {
          enabled: true,
          workspaceName: "acme",
          description,
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

describe("OntologyService", () => {
  it("blocks writes when confidence is below threshold and write not confirmed", async () => {
    const service = new OntologyService(configWithConfidence(""), new FakeAdapter());
    const result = await service.execute({
      operation: "create",
      entityType: "task",
      payload: { title: "Ship ontology" },
    });
    expect(result.needsConfirmation).toBe(true);
    expect(result.records).toHaveLength(0);
  });

  it("allows writes when explicit confirmation is provided", async () => {
    const service = new OntologyService(configWithConfidence(""), new FakeAdapter());
    const result = await service.execute({
      operation: "create",
      entityType: "task",
      payload: { title: "Ship ontology" },
      confirmWrite: true,
    });
    expect(result.needsConfirmation).toBe(false);
    expect(result.records).toHaveLength(1);
  });

  it("resolves natural language text into canonical operations", async () => {
    const service = new OntologyService(
      configWithConfidence("Tasks: Product Tasks DB\nProjects: Product Roadmap DB\nGoals: Q1 Goals\nCRM: Pipeline"),
      new FakeAdapter(),
    );
    const result = await service.executeText('create project "Launch Alpha"');
    expect(result.operation).toBe("create");
    expect(result.entityType).toBe("project");
  });
});
