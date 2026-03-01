/**
 * ONTOLOGY MAPPING
 * ================
 * Build a mapping artifact from natural-language workspace descriptions.
 *
 * KEY CONCEPTS:
 * - Company-specific language is parsed into canonical ontology bindings.
 * - Confidence controls write safety.
 * - Clarification questions are generated when bindings are ambiguous.
 *
 * USAGE:
 * - Used by OntologyService at startup and via RPC explain endpoint.
 *
 * MEMORY REFERENCES:
 * - MEM-0004
 */
import type { FahrenheitConfig } from "../config/schema.js";
import type { OntologyEntityType, OntologyMappingArtifact } from "../types.js";

const entityAliases: Record<OntologyEntityType, string[]> = {
  task: ["task", "tasks", "todo", "todos", "issue", "issues"],
  project: ["project", "projects", "initiative", "initiatives"],
  goal: ["goal", "goals", "okr", "okrs", "objective", "objectives"],
  crmRecord: ["crm", "deal", "deals", "customer", "customers", "opportunity", "opportunities", "account", "accounts"],
};

function extractDatabaseHint(description: string, aliases: string[]): string | undefined {
  const lines = description.split(/\r?\n/);
  for (const line of lines) {
    const normalized = line.toLowerCase();
    if (!aliases.some((alias) => normalized.includes(alias))) continue;
    const delimiterIdx = line.indexOf(":");
    if (delimiterIdx > -1 && delimiterIdx < line.length - 1) {
      return line.slice(delimiterIdx + 1).trim();
    }
    const dashIdx = line.indexOf("-");
    if (dashIdx > -1 && dashIdx < line.length - 1) {
      return line.slice(dashIdx + 1).trim();
    }
  }
  return undefined;
}

function buildQuestions(entityType: OntologyEntityType, hasDatabaseId: boolean, hasHint: boolean): string[] {
  const questions: string[] = [];
  if (!hasDatabaseId && !hasHint) {
    questions.push(`Which Notion database should map to ${entityType}?`);
  }
  return questions;
}

export function inferOntologyMapping(config: FahrenheitConfig): OntologyMappingArtifact {
  const source =
    Object.values(config.ontology.connectors).find((entry) => entry.enabled) ??
    Object.values(config.ontology.connectors)[0];
  const description = source?.description.trim() ?? "";
  const notes: string[] = [];
  const clarificationQuestions: string[] = [];
  let confidenceAccumulator = 0;
  let confidenceWeights = 0;

  const entities = {
    task: { ...(source?.entities.task ?? {}) },
    project: { ...(source?.entities.project ?? {}) },
    goal: { ...(source?.entities.goal ?? {}) },
    crmRecord: { ...(source?.entities.crmRecord ?? {}) },
  };

  (Object.keys(entities) as OntologyEntityType[]).forEach((entityType) => {
    const mapping = entities[entityType];
    const inferredHint = extractDatabaseHint(description, entityAliases[entityType]);
    if (!mapping.databaseNameHint && inferredHint) {
      mapping.databaseNameHint = inferredHint;
      notes.push(`Inferred ${entityType} database hint from description: ${inferredHint}`);
    }

    const hasDatabaseId = Boolean(mapping.databaseId);
    const hasHint = Boolean(mapping.databaseNameHint);
    const questions = buildQuestions(entityType, hasDatabaseId, hasHint);
    clarificationQuestions.push(...questions);

    const entityConfidence = hasDatabaseId ? 1 : hasHint ? 0.7 : 0.25;
    confidenceAccumulator += entityConfidence;
    confidenceWeights += 1;
  });

  const confidence = confidenceWeights > 0 ? Number((confidenceAccumulator / confidenceWeights).toFixed(2)) : 0;

  return {
    generatedAt: new Date().toISOString(),
    description,
    confidence,
    notes,
    clarificationQuestions,
    entities,
  };
}
