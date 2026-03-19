# TKT-001: bootstrap scaffold migration

## Status

- state: `done`
- owner: repo-ops
- assignee: codex
- dependencies: none
- location: `tickets/done`
- enter when: the repo still uses the legacy `docs/progress.md` workflow and is missing current scaffold files
- leave when: root operating docs, ticket board files, troubles/taste docs, and QA guide are in place
- blockers: none
- spawned follow-ups: none
- complexity: `S`

## Description

Migrate ShellCorp from the older progress-doc scaffold to the current docs-first, ticket-board-first setup used by the coding system. This is an operating-files-only change intended to improve planning consistency and agent QA behavior.

## Goal

Make `tickets/*` the active workflow surface, add the missing canonical docs, and give QA a current repo-local guide instead of leaving testing behavior implicit.

## Acceptance Criteria

- [x] AC-1: Root operating docs reference `tickets/*`, `docs/TROUBLES.md`, and `docs/TASTE.md`
- [x] AC-2: The repo contains a usable filesystem ticket board with README, index, and ticket template
- [x] AC-3: The repo contains a QA guide aligned with the current ticket-scoped evidence workflow

## Agent Contract

- Open: read `AGENTS.md`, `PROJECT_RULES.md`, `docs/prompts/*`, and `docs/how-to/qa-agent-guide.md`
- Test hook: none needed
- Stabilize: not applicable
- Inspect: verify file paths and cross-references resolve
- Key screens/states: not applicable
- Taste refs: none
- Expected artifacts: updated docs and board scaffold
- Delegate with: Not needed

## Evidence Checklist

- [x] Screenshot: none needed
- [x] Snapshot: none needed
- [x] QA report linked: none needed for docs-only change

## Build Notes

- Replaced the older root ops docs with ticket-first versions.
- Added `docs/TROUBLES.md`, `docs/TASTE.md`, and `docs/how-to/qa-agent-guide.md`.
- Added `tickets/README.md`, `tickets/INDEX.md`, `tickets/templates/ticket.md`, and this ticket.
- Marked `docs/progress.md` as legacy reference.
- Verified new cross-references resolve.
- `npm run format:check` and `npm run typecheck:root` still fail on pre-existing source issues outside this docs migration.

## QA Reconciliation

- AC-1: `PASS`
- AC-2: `PASS`
- AC-3: `PASS`
- Evidence item: `CAPTURED`

## Artifact Links

- `AGENTS.md`
- `PROJECT_RULES.md`
- `docs/how-to/qa-agent-guide.md`
- `tickets/INDEX.md`

## User Evidence

- Hero screenshot: not applicable
- Supporting evidence: root operating docs now point at the ticket board and QA guide
- QA report: not applicable
- Final verdict: scaffold migration completed

## Required Evidence

- [ ] Unit/integration/e2e tests pass (not run; docs-only migration)
- [ ] Typecheck passes (`extensions/notion/index.ts` has pre-existing root type errors)
- [ ] Lint passes (not run)
