/**
 * NOTION ONTOLOGY ADAPTER
 * =======================
 * Maps canonical ontology operations to Notion databases/pages.
 *
 * KEY CONCEPTS:
 * - Source schema stays behind adapter boundary.
 * - Mapping artifact controls property names.
 * - Canonical entities are returned for all operations.
 *
 * USAGE:
 * - Instantiate once and inject into OntologyService.
 *
 * MEMORY REFERENCES:
 * - MEM-0004
 */
import { Client, isFullPage } from "@notionhq/client";
import type {
  CreatePageParameters,
  PageObjectResponse,
  QueryDataSourceParameters,
  UpdatePageParameters,
} from "@notionhq/client/build/src/api-endpoints.js";

import type { ProviderOperationContext, OntologyProviderAdapter } from "./base.js";
import type { CanonicalEntity, OntologyEntityType, OntologyQueryRequest } from "../types.js";

function propertyAsString(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const typed = value as Record<string, unknown>;

  if (typed.type === "title") {
    const items = Array.isArray(typed.title) ? typed.title : [];
    const plain = items
      .map((item) => (typeof item === "object" && item && "plain_text" in item ? String((item as { plain_text?: string }).plain_text ?? "") : ""))
      .join("")
      .trim();
    return plain || undefined;
  }
  if (typed.type === "rich_text") {
    const items = Array.isArray(typed.rich_text) ? typed.rich_text : [];
    const plain = items
      .map((item) => (typeof item === "object" && item && "plain_text" in item ? String((item as { plain_text?: string }).plain_text ?? "") : ""))
      .join("")
      .trim();
    return plain || undefined;
  }
  if (typed.type === "select") {
    const name = (typed.select as { name?: string } | null | undefined)?.name;
    return name?.trim() || undefined;
  }
  if (typed.type === "status") {
    const name = (typed.status as { name?: string } | null | undefined)?.name;
    return name?.trim() || undefined;
  }
  if (typed.type === "date") {
    const start = (typed.date as { start?: string } | null | undefined)?.start;
    return start?.trim() || undefined;
  }
  if (typed.type === "number") {
    const numberValue = typed.number;
    return typeof numberValue === "number" ? String(numberValue) : undefined;
  }
  if (typed.type === "url") {
    return typeof typed.url === "string" ? typed.url : undefined;
  }
  if (typed.type === "people") {
    const people = Array.isArray(typed.people) ? typed.people : [];
    const names = people
      .map((person) => (typeof person === "object" && person && "name" in person ? String((person as { name?: string }).name ?? "") : ""))
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : undefined;
  }
  if (typed.type === "multi_select") {
    const values = Array.isArray(typed.multi_select) ? typed.multi_select : [];
    const names = values
      .map((item) => (typeof item === "object" && item && "name" in item ? String((item as { name?: string }).name ?? "") : ""))
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : undefined;
  }

  return undefined;
}

function toCanonicalEntity(entityType: OntologyEntityType, page: PageObjectResponse, context: ProviderOperationContext): CanonicalEntity {
  const mapping = context.mapping;
  const properties = page.properties as Record<string, unknown>;
  const titleField = mapping.titleField ?? "Name";
  const statusField = mapping.statusField ?? "Status";
  const summaryField = mapping.summaryField ?? "Summary";
  const ownerField = mapping.ownerField ?? "Owner";
  const dueDateField = mapping.dueDateField ?? "Due";
  const tagsField = mapping.tagsField ?? "Tags";
  const priorityField = mapping.priorityField ?? "Priority";
  const valueField = mapping.valueField ?? "Value";
  const currencyField = mapping.currencyField ?? "Currency";

  const title = propertyAsString(properties[titleField]) ?? `Untitled ${entityType}`;
  const status = propertyAsString(properties[statusField]);
  const summary = propertyAsString(properties[summaryField]);
  const owner = propertyAsString(properties[ownerField]);
  const dueDate = propertyAsString(properties[dueDateField]);
  const tagsRaw = propertyAsString(properties[tagsField]);
  const priority = propertyAsString(properties[priorityField]);
  const valueRaw = propertyAsString(properties[valueField]);
  const currency = propertyAsString(properties[currencyField]);

  return {
    id: page.id,
    entityType,
    title,
    status,
    summary,
    owner,
    dueDate,
    tags: tagsRaw ? tagsRaw.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
    priority,
    value: valueRaw ? Number(valueRaw) : undefined,
    currency,
    externalUrl: page.url,
    source: {
      provider: "notion",
      workspace: context.workspaceName,
      databaseId: context.mapping.databaseId,
      rawId: page.id,
    },
    metadata: {
      archived: page.archived,
    },
  };
}

function buildRichText(content: unknown): Array<{ text: { content: string } }> {
  if (typeof content !== "string" || !content.trim()) return [];
  return [{ text: { content: content.trim() } }];
}

function buildProperties(payload: Record<string, unknown>, context: ProviderOperationContext): CreatePageParameters["properties"] {
  const mapping = context.mapping;
  const titleField = mapping.titleField ?? "Name";
  const statusField = mapping.statusField ?? "Status";
  const summaryField = mapping.summaryField ?? "Summary";
  const ownerField = mapping.ownerField ?? "Owner";
  const dueDateField = mapping.dueDateField ?? "Due";
  const tagsField = mapping.tagsField ?? "Tags";
  const priorityField = mapping.priorityField ?? "Priority";
  const valueField = mapping.valueField ?? "Value";
  const currencyField = mapping.currencyField ?? "Currency";

  const properties: Record<string, unknown> = {};

  if (typeof payload.title === "string" && payload.title.trim()) {
    properties[titleField] = { title: buildRichText(payload.title) };
  }
  if (typeof payload.status === "string" && payload.status.trim()) {
    properties[statusField] = { select: { name: payload.status.trim() } };
  }
  if (typeof payload.summary === "string" && payload.summary.trim()) {
    properties[summaryField] = { rich_text: buildRichText(payload.summary) };
  }
  if (typeof payload.owner === "string" && payload.owner.trim()) {
    properties[ownerField] = { rich_text: buildRichText(payload.owner) };
  }
  if (typeof payload.dueDate === "string" && payload.dueDate.trim()) {
    properties[dueDateField] = { date: { start: payload.dueDate.trim() } };
  }
  if (Array.isArray(payload.tags)) {
    const tags = payload.tags
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((name) => ({ name: name.trim() }));
    properties[tagsField] = { multi_select: tags };
  }
  if (typeof payload.priority === "string" && payload.priority.trim()) {
    properties[priorityField] = { select: { name: payload.priority.trim() } };
  }
  if (typeof payload.value === "number") {
    properties[valueField] = { number: payload.value };
  }
  if (typeof payload.currency === "string" && payload.currency.trim()) {
    properties[currencyField] = { rich_text: buildRichText(payload.currency) };
  }

  return properties as CreatePageParameters["properties"];
}

export class NotionOntologyAdapter implements OntologyProviderAdapter {
  readonly providerId = "notion";
  private readonly client: Client;

  constructor(apiKey: string) {
    this.client = new Client({ auth: apiKey });
  }

  async list(entityType: OntologyEntityType, request: OntologyQueryRequest, context: ProviderOperationContext): Promise<CanonicalEntity[]> {
    const databaseId = this.requireDatabase(context);
    const limit = Math.max(1, Math.min(request.limit ?? 25, 100));
    const queryArgs: QueryDataSourceParameters = {
      data_source_id: databaseId,
      page_size: limit,
    };
    const response = await this.client.dataSources.query(queryArgs);
    return response.results
      .filter((result): result is PageObjectResponse => isFullPage(result))
      .map((page) => toCanonicalEntity(entityType, page, context));
  }

  async get(entityType: OntologyEntityType, request: OntologyQueryRequest, context: ProviderOperationContext): Promise<CanonicalEntity[]> {
    if (!request.id) {
      throw new Error("ontology_get_requires_id");
    }
    const page = await this.client.pages.retrieve({ page_id: request.id });
    if (!isFullPage(page)) return [];
    return [toCanonicalEntity(entityType, page, context)];
  }

  async create(entityType: OntologyEntityType, request: OntologyQueryRequest, context: ProviderOperationContext): Promise<CanonicalEntity[]> {
    const databaseId = this.requireDatabase(context);
    const payload = request.payload ?? {};
    const response = await this.client.pages.create({
      parent: { database_id: databaseId },
      properties: buildProperties(payload, context),
    });
    if (!isFullPage(response)) return [];
    return [toCanonicalEntity(entityType, response, context)];
  }

  async update(entityType: OntologyEntityType, request: OntologyQueryRequest, context: ProviderOperationContext): Promise<CanonicalEntity[]> {
    if (!request.id) throw new Error("ontology_update_requires_id");
    const payload = request.payload ?? {};
    const updateArgs: UpdatePageParameters = {
      page_id: request.id,
      properties: buildProperties(payload, context) as UpdatePageParameters["properties"],
    };
    const response = await this.client.pages.update(updateArgs);
    if (!isFullPage(response)) return [];
    return [toCanonicalEntity(entityType, response, context)];
  }

  async search(entityType: OntologyEntityType, request: OntologyQueryRequest, context: ProviderOperationContext): Promise<CanonicalEntity[]> {
    const needle = request.query?.toLowerCase().trim();
    const list = await this.list(entityType, request, context);
    if (!needle) return list;
    return list.filter((record) => {
      const content = [record.title, record.summary, record.status, record.owner].filter(Boolean).join(" ").toLowerCase();
      return content.includes(needle);
    });
  }

  private requireDatabase(context: ProviderOperationContext): string {
    const databaseId = context.mapping.databaseId;
    if (!databaseId) {
      throw new Error("ontology_database_id_missing");
    }
    return databaseId;
  }
}
