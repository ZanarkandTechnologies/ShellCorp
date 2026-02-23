/**
 * ONTOLOGY SERVICE
 * ================
 * Canonical contract facade for provider-specific implementations.
 *
 * KEY CONCEPTS:
 * - One operation contract across entity types.
 * - Provider adapters hide source-specific schema details.
 * - Write operations enforce confidence + explicit confirmation.
 *
 * USAGE:
 * - Called by gateway RPC methods (`ontology.*`) and text resolver.
 *
 * MEMORY REFERENCES:
 * - MEM-0004
 */
import type { FahrenheitConfig } from "../config/schema.js";
import type { OntologyProviderAdapter } from "../providers/base.js";
import type {
  CanonicalEntity,
  OntologyEntityType,
  OntologyOperation,
  OntologyQueryRequest,
  OntologyQueryResult,
} from "../types.js";
import { inferOntologyMapping } from "./mapping.js";

const writeOperations = new Set<OntologyOperation>(["create", "update"]);

export class OntologyService {
  private readonly mapping;
  private readonly source;

  constructor(
    private readonly config: FahrenheitConfig,
    private readonly adapter: OntologyProviderAdapter,
  ) {
    this.source =
      Object.values(config.ontology.connectors).find((entry) => entry.enabled) ??
      Object.values(config.ontology.connectors)[0] ??
      null;
    this.mapping = inferOntologyMapping(config);
  }

  getMappingArtifact() {
    return this.mapping;
  }

  async execute(request: OntologyQueryRequest): Promise<OntologyQueryResult> {
    this.assertEnabled();
    const entityMapping = this.mapping.entities[request.entityType];
    const notes = [...this.mapping.notes];
    const needsConfirmation =
      writeOperations.has(request.operation) &&
      this.mapping.confidence < this.config.ontology.writeMinConfidence &&
      !request.confirmWrite;

    if (needsConfirmation) {
      return {
        operation: request.operation,
        entityType: request.entityType,
        confidence: this.mapping.confidence,
        needsConfirmation: true,
        clarificationQuestions: [
          ...this.mapping.clarificationQuestions,
          `Write confidence ${this.mapping.confidence} is below threshold ${this.config.ontology.writeMinConfidence}. Confirm write?`,
        ],
        records: [],
        notes,
      };
    }

    const context = {
      workspaceName: this.source?.workspaceName ?? "default",
      mapping: entityMapping,
    };

    let records: CanonicalEntity[];
    switch (request.operation) {
      case "list":
        records = await this.adapter.list(request.entityType, request, context);
        break;
      case "get":
        records = await this.adapter.get(request.entityType, request, context);
        break;
      case "create":
        records = await this.adapter.create(request.entityType, request, context);
        break;
      case "update":
        records = await this.adapter.update(request.entityType, request, context);
        break;
      case "search":
        records = await this.adapter.search(request.entityType, request, context);
        break;
      default:
        records = [];
    }

    return {
      operation: request.operation,
      entityType: request.entityType,
      confidence: this.mapping.confidence,
      needsConfirmation: false,
      clarificationQuestions: this.mapping.clarificationQuestions,
      records,
      notes,
    };
  }

  async executeText(input: string): Promise<OntologyQueryResult> {
    this.assertEnabled();
    const request = this.resolveTextRequest(input);
    return this.execute(request);
  }

  private resolveTextRequest(input: string): OntologyQueryRequest {
    const normalized = input.toLowerCase();
    const operation = this.inferOperation(normalized);
    const entityType = this.inferEntityType(normalized);
    const titleMatch = input.match(/"(.*?)"/);
    const payloadTitle = titleMatch?.[1]?.trim();

    const payload: Record<string, unknown> | undefined =
      operation === "create" || operation === "update"
        ? {
            ...(payloadTitle ? { title: payloadTitle } : {}),
          }
        : undefined;

    return {
      operation,
      entityType,
      query: operation === "search" || operation === "list" ? input : undefined,
      payload,
      limit: 20,
      confirmWrite: normalized.includes("confirm"),
    };
  }

  private inferOperation(normalized: string): OntologyOperation {
    if (normalized.includes("create") || normalized.includes("add ") || normalized.includes("new ")) return "create";
    if (normalized.includes("update") || normalized.includes("set ") || normalized.includes("change ")) return "update";
    if (normalized.includes("search") || normalized.includes("find ")) return "search";
    if (normalized.includes("get ") || normalized.includes("show ")) return "get";
    return "list";
  }

  private inferEntityType(normalized: string): OntologyEntityType {
    if (normalized.includes("goal")) return "goal";
    if (normalized.includes("project")) return "project";
    if (
      normalized.includes("crm") ||
      normalized.includes("deal") ||
      normalized.includes("customer") ||
      normalized.includes("account") ||
      normalized.includes("opportunit")
    ) {
      return "crmRecord";
    }
    return "task";
  }

  private assertEnabled(): void {
    if (!this.config.ontology.enabled) {
      throw new Error("ontology_disabled");
    }
    if (!this.source || !this.source.enabled) {
      throw new Error("ontology_source_not_enabled");
    }
  }
}
