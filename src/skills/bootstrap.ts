/**
 * CONNECTOR SKILL BOOTSTRAP
 * =========================
 * Builds/proves connector-backed generated skills and emits evidence artifacts.
 *
 * KEY CONCEPTS:
 * - Free-form connector profiles describe ontology/tool/workflow intent.
 * - Proof run validates fetch behavior and captures output evidence.
 * - Commit is gated by confidence + trust policy before memory writes.
 *
 * USAGE:
 * - Used by gateway RPC connector bootstrap methods.
 *
 * MEMORY REFERENCES:
 * - MEM-0010
 * - MEM-0011
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { FahrenheitConfig } from "../config/schema.js";
import type { CanonicalEntity, ObservationEvent, OntologyEntityType } from "../types.js";
import type { OntologyService } from "../ontology/service.js";
import type { ObservationalMemoryPipeline } from "../memory/pipeline.js";
import { toObservationPreview } from "./transform.js";
import { NotionOntologyAdapter, type NotionDiscoveredSource } from "../providers/notion.js";

const defaultEntityProbeOrder: OntologyEntityType[] = ["task", "project", "goal", "crmRecord"];

export interface ConnectorProofResult {
  connectorId: string;
  fetchedRecords: CanonicalEntity[];
  observationPreview: ObservationEvent[];
  generatedSkillPath: string;
  evidencePath: string;
  confidence: number;
}

export interface ConnectorOnboardingSource {
  id: string;
  title: string;
  url?: string;
  objectType: string;
  lastEditedTime?: string;
}

export interface EntityMappingProposal {
  entityType: OntologyEntityType;
  databaseId?: string;
  databaseNameHint?: string;
  matchedSourceTitle?: string;
  confidence: number;
  rationale: string;
}

export interface ConnectorOnboardingProposal {
  connectorId: string;
  platform: string;
  discoveredSources: ConnectorOnboardingSource[];
  selectedSourceIds: string[];
  mappingProposals: EntityMappingProposal[];
  unresolved: string[];
  generatedSkillPath: string;
  generatedConfigPath: string;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function scoreNameMatch(hint: string, candidate: string): number {
  const a = normalizeName(hint);
  const b = normalizeName(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;
  const shared = [...new Set(a)].filter((char) => b.includes(char)).length;
  const ratio = shared / Math.max(a.length, b.length);
  return Number(Math.max(0, Math.min(0.85, ratio)).toFixed(3));
}

function discoverConnectorPlatform(connector: FahrenheitConfig["ontology"]["connectors"][string]): string {
  return connector.provider?.trim() || "unknown";
}

export async function discoverConnectorSources(
  config: FahrenheitConfig,
  connectorId: string,
  options: {
    sourcesOverride?: ConnectorOnboardingSource[];
  } = {},
): Promise<{ platform: string; sources: ConnectorOnboardingSource[] }> {
  const connector = config.ontology.connectors[connectorId];
  if (!connector) throw new Error(`connector_not_found:${connectorId}`);
  if (!connector.enabled) throw new Error(`connector_not_enabled:${connectorId}`);
  const platform = discoverConnectorPlatform(connector);
  if (options.sourcesOverride) {
    return {
      platform,
      sources: [...options.sourcesOverride].sort((a, b) => a.title.localeCompare(b.title)),
    };
  }
  if (platform !== "notion") {
    throw new Error(`connector_discovery_not_supported:${platform}`);
  }
  if (!connector.apiKey) throw new Error(`connector_api_key_required:${connectorId}`);
  const adapter = new NotionOntologyAdapter(connector.apiKey);
  const sources: NotionDiscoveredSource[] = await adapter.discoverDataSources();
  return {
    platform,
    sources,
  };
}

export async function proposeConnectorOnboarding(
  workspaceDir: string,
  config: FahrenheitConfig,
  connectorId: string,
  selectedSourceIds?: string[],
  options: {
    sourcesOverride?: ConnectorOnboardingSource[];
  } = {},
): Promise<ConnectorOnboardingProposal> {
  const connector = config.ontology.connectors[connectorId];
  if (!connector) throw new Error(`connector_not_found:${connectorId}`);
  const { platform, sources } = await discoverConnectorSources(config, connectorId, options);
  const selected = selectedSourceIds && selectedSourceIds.length > 0
    ? sources.filter((source) => selectedSourceIds.includes(source.id))
    : sources;
  const selectedIds = selected.map((source) => source.id);
  const unresolved: string[] = [];
  const mappingProposals: EntityMappingProposal[] = [];
  for (const entityType of defaultEntityProbeOrder) {
    const mapping = connector.entities[entityType];
    if (mapping.databaseId) {
      const matchedSource = selected.find((source) => source.id === mapping.databaseId);
      mappingProposals.push({
        entityType,
        databaseId: mapping.databaseId,
        databaseNameHint: mapping.databaseNameHint,
        matchedSourceTitle: matchedSource?.title,
        confidence: 1,
        rationale: "Using existing configured databaseId.",
      });
      continue;
    }
    const hint = mapping.databaseNameHint || mapping.databaseId || entityType;
    const scored = selected
      .map((source) => ({ source, score: scoreNameMatch(hint, source.title) }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best || best.score < 0.55) {
      unresolved.push(entityType);
      mappingProposals.push({
        entityType,
        databaseNameHint: mapping.databaseNameHint,
        confidence: 0.2,
        rationale: "No sufficiently strong source-title match found.",
      });
      continue;
    }
    mappingProposals.push({
      entityType,
      databaseId: best.source.id,
      databaseNameHint: mapping.databaseNameHint,
      matchedSourceTitle: best.source.title,
      confidence: best.score,
      rationale: `Resolved by name hint matching (${best.score.toFixed(2)}).`,
    });
  }
  const skill = manifestForConnector(connectorId, connector);
  const generatedDir = path.join(workspaceDir, "skills", ".generated", connectorId);
  await mkdir(generatedDir, { recursive: true });
  const generatedSkillPath = path.join(generatedDir, "SKILL.md");
  const generatedConfigPath = path.join(generatedDir, "config.json");
  await writeFile(generatedSkillPath, `${skill.instruction}\n`, "utf8");
  await writeFile(generatedConfigPath, `${JSON.stringify(skill.config, null, 2)}\n`, "utf8");
  return {
    connectorId,
    platform,
    discoveredSources: sources,
    selectedSourceIds: selectedIds,
    mappingProposals,
    unresolved,
    generatedSkillPath,
    generatedConfigPath,
  };
}

function generatedSkillName(connectorId: string, configuredName: string): string {
  if (configuredName.trim()) return configuredName.trim();
  return `connector-${connectorId}-fetch`;
}

function manifestForConnector(connectorId: string, connector: FahrenheitConfig["ontology"]["connectors"][string]): {
  instruction: string;
  config: Record<string, unknown>;
} {
  const name = generatedSkillName(connectorId, connector.bootstrap.generatedSkillName);
  return {
    instruction: [
      `# ${name}`,
      "",
      "Generated connector skill for ontology fetch proving.",
      "",
      "## Profile",
      `- Ontology: ${connector.profile.ontologyInstructions}`,
      `- Tools: ${connector.profile.toolsInstructions}`,
      `- Workflow: ${connector.profile.workflowInstructions}`,
      `- Fetch: ${connector.profile.fetchInstructions}`,
      `- Transform: ${connector.profile.transformInstructions}`,
    ].join("\n"),
    config: {
      env: {
        CONNECTOR_ID: connectorId,
      },
      command:
        "curl -s -X POST \"${FAHRENHEIT_GATEWAY_URL:-http://127.0.0.1:8787}/rpc\" -H \"content-type: application/json\" -d '{\"method\":\"ontology.query\",\"params\":{\"operation\":\"list\",\"entityType\":\"task\",\"limit\":5}}'",
      trustClass: connector.trustClass,
      writeCapable: false,
    },
  };
}

export async function runConnectorProof(
  workspaceDir: string,
  config: FahrenheitConfig,
  ontologyService: OntologyService,
  connectorId: string,
): Promise<ConnectorProofResult> {
  const connector = config.ontology.connectors[connectorId];
  if (!connector) throw new Error(`connector_not_found:${connectorId}`);
  if (!connector.enabled) throw new Error(`connector_not_enabled:${connectorId}`);

  const fetchedRecords: CanonicalEntity[] = [];
  for (const entityType of defaultEntityProbeOrder) {
    const response = await ontologyService.execute({
      operation: "list",
      entityType,
      limit: 5,
    });
    fetchedRecords.push(...response.records);
  }

  const observationPreview = toObservationPreview({
    connectorId,
    projectId: connector.projectTags[0] ?? connector.workspaceName,
    groupId: connector.workspaceName,
    sessionKey: `group:${connector.workspaceName}:main`,
    projectTags: connector.projectTags,
    roleTags: connector.roleTags,
    trustClass: connector.trustClass,
    sourceRef: `ontology.connectors.${connectorId}`,
    records: fetchedRecords,
  });

  const skill = manifestForConnector(connectorId, connector);
  const generatedDir = path.join(workspaceDir, "skills", ".generated", connectorId);
  await mkdir(generatedDir, { recursive: true });
  const generatedSkillPath = path.join(generatedDir, "SKILL.md");
  const generatedConfigPath = path.join(generatedDir, "config.json");
  await writeFile(generatedSkillPath, `${skill.instruction}\n`, "utf8");
  await writeFile(generatedConfigPath, `${JSON.stringify(skill.config, null, 2)}\n`, "utf8");

  const evidenceDir = path.join(workspaceDir, ".memory", "connector-proofs");
  await mkdir(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, `${connectorId}-${Date.now()}.json`);
  const confidence = fetchedRecords.length > 0 ? 0.85 : 0.35;
  await writeFile(
    evidencePath,
    `${JSON.stringify(
      {
        connectorId,
        fetchedCount: fetchedRecords.length,
        confidence,
        records: fetchedRecords,
        observationPreview,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return {
    connectorId,
    fetchedRecords,
    observationPreview,
    generatedSkillPath,
    evidencePath,
    confidence,
  };
}

export async function commitProofToMemory(
  proof: ConnectorProofResult,
  pipeline: ObservationalMemoryPipeline,
  config: FahrenheitConfig,
  partition: { projectId: string; groupId: string; sessionKey: string },
): Promise<{ committed: number; blocked: boolean }> {
  const connector = config.ontology.connectors[proof.connectorId];
  if (!connector) throw new Error(`connector_not_found:${proof.connectorId}`);
  const threshold = connector.bootstrap.minConfidence;
  const confidenceAllowed = proof.confidence >= threshold;
  if (!confidenceAllowed || !connector.bootstrap.allowGatedWrites) {
    return { committed: 0, blocked: true };
  }

  let committed = 0;
  for (const event of proof.observationPreview) {
    await pipeline.recordPollingRun(
      {
        ts: Date.now(),
        jobId: `connector-proof:${proof.connectorId}`,
        status: "ok",
        detail: event.summary,
      },
      {
        projectId: partition.projectId,
        groupId: partition.groupId,
        sessionKey: partition.sessionKey,
        source: proof.connectorId,
        sourceRef: event.sourceRef,
        summary: event.summary,
        projectTags: event.projectTags,
        roleTags: event.roleTags,
        trustClass: event.trustClass,
        confidence: event.confidence,
        metadata: event.metadata,
      },
    );
    committed += 1;
  }
  return { committed, blocked: false };
}
