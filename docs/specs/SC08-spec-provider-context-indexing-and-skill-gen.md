# SC08: Provider Context Indexing and Generated Skill Catalog

## Scope

Define how Shell Company indexes provider data structures (Notion databases, Vibe boards, internal task schemas) and generates deterministic context tools/skills that agents can invoke during OpenClaw sessions.

## Canonical References

- OpenClaw Multi-Agent Routing: https://docs.openclaw.ai/concepts/multi-agent#multi-agent-routing
- OpenClaw Plugins: https://docs.openclaw.ai/tools/plugin#plugins
- `SC01`: `docs/specs/SC01-spec-openclaw-state-mapping.md`
- `SC02`: `docs/specs/SC02-spec-notion-plugin-inrepo.md`
- `SC06`: `docs/specs/SC06-spec-kanban-federation-sync.md`
- `ST01`: `docs/specs/studies/ST01-founder-direction-openclaw-personalization.md`

## Product Rule

- Provider schemas are the source of truth for indexable structures.
- Generated commands are deterministic: same provider schema version yields same command identifiers.
- Generation remains plugin-first and skill-file-first, never bespoke gateway-only logic.
- Operators explicitly choose indexed entities and active generated tools.

## Data Contracts

### ProviderIndexEntry

- `indexId`
- `provider`: `notion | vibe | internal`
- `entityType`: `database | board | collection`
- `entityId`
- `entityName`
- `schemaVersion` (content hash)
- `fields[]`: `{ name, type, options?, relation? }`
- `indexedAt`
- `status`: `healthy | stale | error`
- `error` (optional)

### GeneratedToolDefinition

- `toolId` (deterministic from provider/entity/schemaVersion)
- `commandName` (deterministic slug)
- `description`
- `provider`
- `indexEntryId`
- `parameters[]`: `{ name, type, required, description }`
- `returnSchema`
- `generatedAt`
- `schemaVersion`

### ContextToolCatalog

- `catalogId`
- `agentId` (optional; null means shared)
- `tools[]`
- `updatedAt`

### IndexPolicy

- `projectId`
- `provider`
- `autoReindex`
- `reindexIntervalMinutes` (optional)
- `enabledEntities[]` (allowlist)
- `toolNamingPrefix` (optional)

## Required Flows

### Index Provider Schema

1. Operator selects provider/entity (or policy auto-triggers).
2. Adapter fetches and normalizes provider schema.
3. System computes `schemaVersion`; unchanged versions skip regeneration.
4. Index entries persist locally for OpenClaw/ShellCorp read paths.
5. Skills panel surfaces index health.

### Generate Tools/Skills

1. On new/changed index, generator emits deterministic definitions.
2. Tool stubs are published through extension contracts.
3. Skill catalog is updated with schema stamps.
4. Stale tools are deprecated, not silently removed.

### Reindex on Drift

1. Drift detection marks old schema entries stale.
2. Auto or manual reindex regenerates definitions.
3. Stale command invocation returns descriptive guidance.

## UI Requirements

- Skills panel shows generated tools with provider badge + schema version.
- Operators can trigger manual reindex and enable/disable generated tools.
- Stale/error tools are visibly distinct with fix actions.
- Index history is auditable (who/when/version).

## Security Notes

- Provider credentials remain outside browser-local storage.
- Generated definitions are declarative; execution remains in trusted adapters/plugins.
- First slice defaults to explicit allowlist, not full-provider crawl.

## Acceptance Criteria

- At least one provider can be indexed and produce generated tools.
- Deterministic naming is stable across repeated generation from same schema.
- Schema changes produce stale detection and controlled regeneration.
- Generated tools are invocable in OpenClaw session workflows.
- UI can inspect and control generated tool activation.
