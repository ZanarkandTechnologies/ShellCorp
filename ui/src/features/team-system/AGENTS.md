# TEAM SYSTEM

## Boundaries

- `components/team-panel.tsx` is the panel shell only; heavy domain orchestration should live in focused hooks/helpers.
- Team/task operational state is realtime-first and should prefer existing Convex board/status paths over duplicate local stores.
- OpenClaw agent-private memory remains an external/runtime-owned surface; do not fold it into shared team state implicitly.

## Invariants

- Keep tab props stable unless the UI contract intentionally changes.
- Prefer markdown-shaped content inside existing task/team state over inventing large JSON workflow models.
- Artefact browsing must stay lazy; do not introduce full recursive workspace loads on panel open.

## Tests

- Keep Team Panel tests/helpers colocated in `components/`.
- Favor targeted regression coverage for derived helpers and hook extraction seams.

## Conventions

- Add the required header block to new major logic files.
- Reuse `team-panel-types.ts` for cross-tab shared types.
