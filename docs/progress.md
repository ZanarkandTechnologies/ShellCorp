# Fahrenheit Observational Memory Slice Board

**Status**: In progress
**Scope**: SLC-03 observational memory (Notion + Slack MVP)
**Date**: 2026-02-24

This slice establishes structured observational memory for workflow deltas across Notion and Slack, adds trust-gated promotion into durable memory, and enables heartbeat-driven compression with replay snapshots.

## Ticket Board (Active Slice: SLC-03)

| ID | Title | Depends On | Status |
| --- | --- | --- | --- |
| OM-001 | Define observation event contract and project/role partitions | - | completed |
| OM-002 | Implement structured history append + provenance/trust metadata | OM-001 | completed |
| OM-003 | Add trust-gated promotion engine (`informational`, `operational`, `warning`) | OM-001, OM-002 | completed |
| OM-004 | Implement combined-threshold compression with snapshot before truncate | OM-002 | completed |
| OM-005 | Wire Notion/Slack polling and observational ingress into memory intake | OM-001, OM-002, OM-003 | completed |
| OM-006 | Add first-pass insight extraction (blocker/risk/upsell/improvement) | OM-001, OM-002 | completed |
| OM-007 | Add tests, runbook evidence, and backpressure checks | OM-001..OM-006 | completed |

## Implemented Evidence (SLC-03)

- Observation contracts and promotion types added in `src/types.ts`.
- Structured observation parsing/derivation added in `src/memory/observations.ts`.
- `MemoryStore` now supports:
  - structured observation append to `HISTORY.md`
  - trust-gated auto-promotion to `MEMORY.md`
  - replay-safe compression with snapshots
  - structured observation listing
- New memory pipeline adapter in `src/memory/pipeline.ts` handles:
  - observational gateway ingress writes
  - cron polling run ingestion for provider sources
  - heartbeat compression hook
- Gateway integration updates:
  - `src/gateway/router.ts` emits observational payloads to memory intake callback
  - `src/gateway/server.ts` wires memory pipeline to router, cron, and heartbeat
  - new RPC write endpoint: `memory.observation.append` (auth-gated)
- Scheduler integration updates:
  - `src/scheduler/cron.ts` supports optional observation metadata per job and run-complete callback
  - `src/scheduler/heartbeat.ts` supports pre-prompt maintenance callback
- Config and examples updated:
  - `src/config/schema.ts` (`runtime.memory.*`, ontology connector partition/trust metadata)
  - `src/config/loader.ts` (`runtime.memory.compression.snapshotDir` expansion)
  - `fahrenheit.example.json` (memory config and connector tags/trust)
- Memory module scaffolding added:
  - `src/memory/AGENTS.md`
  - `src/memory/README.md`

## Acceptance Criteria (SLC-03)

- [x] Cron/observer flows can append structured entries to `HISTORY.md`.
- [x] Promotion writes trusted/system entries to `MEMORY.md`, untrusted entries stay gated.
- [x] Compression uses combined threshold and snapshots before truncate.
- [x] Memory events preserve provenance/trust metadata.
- [x] Blocker/risk/upsell/improvement signals are captured as typed observations.
- [x] Brain prompt continues to include durable `MEMORY.md` context each turn.

## Required Backpressure Evidence

- Focused tests passed:
  - `npx vitest run src/memory/store.test.ts src/memory/pipeline.test.ts src/scheduler/cron.test.ts src/gateway/routing.test.ts`
- Full `npm run test:once` currently fails due existing Convex test environment gap (`_generated` missing) unrelated to SLC-03 changes.
- `npm run typecheck` / `npm run build` currently fail due pre-existing type errors in `src/channels/discord.ts` and `src/channels/whatsapp.ts`, unrelated to SLC-03.

## Next Slice Handoff

- SLC-11 can consume `ObservationEvent` contracts for richer extractor models and confidence policying.
- SLC-05 can use observation provenance/tags to scaffold generated skill manifests and sessionized tool calls.
