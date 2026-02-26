# SC06: Kanban Federation and Sync Policy

## Scope

Define the first production-safe federation layer for internal Shell Company tasks and external provider boards (Notion and Vibe Kanban) without introducing multi-master ambiguity.

## Canonical References

- OpenClaw Multi-Agent Routing: https://docs.openclaw.ai/concepts/multi-agent#multi-agent-routing
- OpenClaw Plugins: https://docs.openclaw.ai/tools/plugin#plugins
- `ST01`: `docs/specs/studies/ST01-founder-direction-openclaw-personalization.md`

## Product Rule: Source of Truth

For SC06, source-of-truth is **canonical-provider-per-project**:

- Each project selects one canonical board provider (`internal`, `notion`, or `vibe`).
- Canonical provider owns mutable task truth for that project.
- Shell Company maintains a unified read model across all projects/providers.
- Cross-provider duplication is optional and policy-driven, not implicit.

## Why This Model

- Preserves existing operator workflows in specialized tools.
- Avoids first-slice multi-master conflict complexity.
- Keeps Shell Company focused on observability and orchestration.

## Data Contracts

### FederatedTaskModel

- `taskId`: provider-stable id
- `projectId`
- `provider`: `internal | notion | vibe`
- `canonicalProvider`: `internal | notion | vibe`
- `title`
- `status`: `todo | in_progress | blocked | done`
- `assigneeAgentId` (optional)
- `priority` (optional)
- `updatedAt`
- `providerUrl` (optional deep link)
- `syncState`: `healthy | pending | conflict | error`
- `syncError` (optional)

### FederationProjectPolicy

- `projectId`
- `canonicalProvider`
- `mirrors[]` (optional read mirrors)
- `writeBackEnabled`: boolean
- `conflictPolicy`: `canonical_wins | newest_wins` (SC06 default: `canonical_wins`)

## Sync Flows

### Inbound (Provider -> Shell)

- Polling/webhook events are normalized through provider adapters.
- Events update the unified read model with sync metadata.
- Invalid payloads are rejected and surfaced as sync errors.

### Outbound (Shell -> Provider)

- Shell task edits for a project route only to that project's canonical provider.
- Mirror provider writes are disabled by default in SC06.
- Outbound failures keep local optimistic state flagged as `error` until reconcile.

## Conflict Semantics

- If provider timestamp and Shell update diverge, canonical provider wins by default.
- Conflicts are visible in UI with provider and timestamp context.
- No hidden auto-merge for first slice.

## UI Requirements

- Team Kanban panel can filter by provider and sync health.
- Task cards display provider badge and deep link.
- Sync state is explicit (`healthy`, `pending`, `conflict`, `error`).
- Operators can request manual resync per project.

## OpenClaw Integration Surface

- Provider syncs should be exposed as plugin methods via extension contracts.
- Adapter layer remains thin and plugin-first for provider logic.
- Secrets remain outside browser-local persistence.

## Acceptance Criteria

- Operators can view one unified board with tasks from at least internal + one external provider.
- Per-project canonical provider policy is enforced for all writes.
- Sync errors/conflicts are visible and actionable in UI.
- No dependence on Convex-only task infrastructure in ShellCorp.
