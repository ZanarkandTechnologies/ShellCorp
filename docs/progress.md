# Fahrenheit Chat Config Slice Board

**Status**: In progress
**Scope**: SLC-02 chat-native config + cron control
**Date**: 2026-02-24

This slice makes operational controls accessible while in chat sessions by adding a runtime bridge to gateway config/cron methods, while preserving policy gates and auditability for write actions.

## Ticket Board (Active Slice: SLC-02)

| ID | Title | Depends On | Status |
| --- | --- | --- | --- |
| S2-201 | Schema + contract for chat configuration tools | - | in_progress |
| S2-202 | Runtime gateway-RPC bridge for chat sessions | S2-201 | in_progress |
| S2-203 | Safe config-write path with policy gates | S2-201, S2-202 | in_progress |
| S2-204 | CLI parity + tests for chat-driven operations | S2-202, S2-203 | in_progress |

## Acceptance Criteria (SLC-02)

- Chat session can read config and manage cron directly without manual `bash + curl`.
- Chat session can apply config writes only when policy allows.
- Write actions include correlation metadata and are auditable.
- CLI config mutations and chat mutations use equivalent backend contracts.
- Backpressure evidence captured (`npm run test:once`, `npm run typecheck`, `npm run build`) with unrelated baseline failures explicitly called out.

## Implemented Evidence (SLC-02)

- Runtime chat command bridge added in `src/agent/runner.ts`:
  - `/config get|channels|groups`
  - `/config apply <json> --confirm`
  - `/config reload --confirm`
  - `/cron list|runs|add|update|enable|disable|remove`
- Gateway RPC tool mapping centralized for policy in `src/security/policy.ts` and applied in `src/gateway/server.ts`.
- CLI config parity added:
  - `config get --path`
  - `config set --path --value`
  - `config validate`
  - files: `src/cli/commands/config.ts`, `src/cli/index.ts`
- Runtime gateway control wiring added for gateway/agent/tui creation paths:
  - `src/gateway/server.ts`
  - `src/cli/commands/agent.ts`
  - `src/cli/commands/tui.ts`
- Tests added:
  - `src/agent/runner.control.test.ts`
  - `src/cli/commands/config.test.ts`
  - `src/security/policy.test.ts` expanded

## Required Evidence / Backpressure

- Focused tests passed:
  - `npx vitest run src/security/policy.test.ts src/agent/runner.control.test.ts src/cli/commands/config.test.ts src/scheduler/cron.test.ts src/config/loader.test.ts`
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run test:once` currently fails only in `convex/messages.test.ts` because Convex `_generated` artifacts are missing in this environment (unrelated baseline issue).

## Queued Follow-Ups (Not Active)

1. **SLC-04**: scheduler runtime controls beyond current cron contract.
2. **SLC-05**: richer skill/tool discovery and OpenClaw-like slash ergonomics (`/config`, `/debug`) on top of this bridge.

## Completed Follow-Up (Memory UI Tab)

- Added read-only memory APIs in `src/gateway/server.ts`:
  - `GET /memory/stats`
  - `GET /memory/observations`
  - `GET /memory/summary`
  - `GET /memory/history`
  - `GET /memory/search`
- Added helper coverage in `src/gateway/memory.test.ts` for observation filtering and KPI aggregation.
- Added Gateway UI memory surface in:
  - `ui/src/App.tsx` (tabs: Events, Config, Memory)
  - `ui/src/MemorySection.tsx`
  - `ui/src/styles.css` (memory tab/panel styling)
- Validation status:
  - `npx vitest run src/gateway/memory.test.ts src/memory/store.test.ts src/memory/pipeline.test.ts src/gateway/routing.test.ts src/config/loader.test.ts` passed
  - `npm run typecheck` passed
  - `npm run build` passed
  - `npm run test:once` fails only in `convex/messages.test.ts` due missing Convex `_generated` in current environment

## Active Slice (Group-Centric Observational Memory)

Status: in_progress

| ID | Title | Status |
| --- | --- | --- |
| GRP-001 | Group rollup cron contract | completed |
| GRP-002 | Source aggregation skill/tool per group | completed |
| GRP-003 | Persistent group agent behavior | completed |
| GRP-004 | DB-first memory write path | completed |
| GRP-005 | Guardrails + quality controls | completed |
| GRP-006 | Memory UI group-centric visibility | completed |
| GRP-007 | Validation + onboarding runbook | in_progress |

## Active Slice (Hybrid Onboarding + Dual-Key Memory)

Status: in_progress

| ID | Title | Status |
| --- | --- | --- |
| ONB-201 | Onboarding RPC contract + policy wiring | completed |
| ONB-202 | Notion source discovery + hint resolution | completed |
| ONB-203 | Proposal artifacts for mappings/skills | completed |
| ONB-204 | Dual-required keys (`projectId` + `groupId`) for memory writes/reads | completed |
| ONB-205 | Workflow signal extraction schema (category/rationale/provenance) | completed |
| ONB-206 | Docs + runbooks + memory/history updates | completed |
| ONB-207 | Tests for onboarding/proposal/partition isolation | in_progress |
