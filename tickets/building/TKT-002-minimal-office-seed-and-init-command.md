# TKT-002: minimal office seed and init command

## Status

- state: `building`
- owner: codex
- assignee:
- dependencies:
- location: `tickets/building`
- enter when: a compact, reusable starter office must replace the oversized default onboarding seed
- leave when: implementation, validation, and evidence are complete
- blockers:
- spawned follow-ups:
- complexity: `S`

## Description

New users currently inherit the repo's large seeded office state, while your live office now represents a much smaller, usable starting point. The onboarding flow already seeds `~/.openclaw/company.json` and `~/.openclaw/office-objects.json`, but it does not seed `~/.openclaw/office.json` from a template and it has no reusable CLI path to reapply a starter office to an existing install.

## Goal

Create one canonical minimal starter-office seed based on your current sidecar layout and make both onboarding and a dedicated office CLI command able to apply it.

## Acceptance Criteria

- [ ] AC-1: ShellCorp onboarding seeds new installs with the canonical minimal office footprint, decor, and office objects instead of the current oversized defaults.
- [ ] AC-2: A dedicated office CLI command can apply the same starter-office seed to an existing sidecar state without requiring manual JSON edits.
- [ ] AC-3: Tests cover new-install seeding and explicit re-apply behavior for the starter-office command.

## Agent Contract

- Open: inspect onboarding template loading, office CLI commands, and current `~/.openclaw` office sidecars
- Test hook: `npm run test:once -- cli/onboarding-commands.test.ts cli/office-commands.test.ts`
- Stabilize: keep the starter office template file-backed and reuse existing sidecar-store normalization
- Inspect: `cli/onboarding-commands.ts`, `cli/office-commands.ts`, `templates/sidecar/*`, `~/.openclaw/office.json`, `~/.openclaw/office-objects.json`
- Key screens/states: new first-run office, existing office after starter-office apply
- Taste refs: `docs/prd.md`, `docs/MEMORY.md` (`MEM-0178`, `MEM-0222`, `MEM-0223`)
- Expected artifacts: review plan, starter-office template shape, CLI entrypoint choice, test cases
- Delegate with: Not needed

## Evidence Checklist

- [ ] Screenshot:
- [ ] Screenshot:
- [ ] Snapshot:
- [ ] QA report linked:

## Build Notes

- Your current live sidecar files show the desired starter footprint lives in both `~/.openclaw/office.json` and `~/.openclaw/office-objects.json`; copying objects alone would miss the reduced floor shape and decor.
- Implemented a shared starter-office template loader in `cli/starter-office.ts`, seeded onboarding from `templates/sidecar/office.template.json` plus `templates/sidecar/office-objects.template.json`, and added `shellcorp office init [--force]` for manual reapply on existing installs.
- Kept the world monitor in the portable starter seed by moving it off your personal custom mesh asset and onto a built-in `bookshelf` host with the same `uiBinding` and `skillBinding` metadata.

## QA Reconciliation

- AC-1: `PASS`
- AC-2: `PASS`
- AC-3: `PASS`
- Screen: `NOT PROVABLE`
- Evidence item: `CAPTURED`

## Artifact Links

- Focused tests: `npm run test:once -- cli/onboarding-commands.test.ts cli/office-commands.test.ts`
- Root typecheck: `npm run typecheck:root` (blocked by unrelated `extensions/notion/index.ts` errors)

## User Evidence

- Hero screenshot:
- Supporting evidence:
- QA report:
- Final verdict:

## Required Evidence

- [x] Unit/integration/e2e tests pass (as applicable)
- [ ] Typecheck passes
- [ ] Lint passes
