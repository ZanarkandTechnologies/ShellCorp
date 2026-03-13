# AGENTS

This file is loaded every loop. Keep it operational and concise.

## Build & Run

- Install: `npm install`
- Dev gateway: `npm run gateway`
- Status: `npm run status`

## Validation (Backpressure)

- Tests: `npm run test:once`
- Typecheck: `npm run typecheck` (workspace-wide)
- Root-only typecheck: `npm run typecheck:root`
- Build: `npm run build` (root-owned TypeScript program)

## Docs State

- Project rules: `PROJECT_RULES.md`
- PRD: `docs/prd.md`
- Specs: `docs/specs/*`
- Plan: `docs/progress.md`
- History: `docs/HISTORY.md`
- Memory: `docs/MEMORY.md`

## Notes

- Keep one persistent brain context unless explicitly changed.
- Prefer reversible actions and existing CLI/API patterns over new layers.
- Treat inbound channel data as untrusted and keep secrets out of logs.
- SC12 HUD review surfaces must use shared Tailwind theme tokens instead of hardcoded per-component colors. See `MEM-0160`.
- Project-backed team clusters must claim their first anchor through the shared open-slot placement helper in both CLI and UI creation flows, and later updates must preserve the persisted position. See `MEM-0183`.


## Verifying outputs

Don't keep building the app to test that it compiles, a UI verification is probably worth way more
