# Team System

## Purpose

Team-level operator surfaces for overview, kanban, artefacts, timeline, and business workflows.

## Public API / Entrypoints

- `components/team-panel.tsx`
- Tab components under `components/`
- Shared types in `components/team-panel-types.ts`

## Minimal Example

```tsx
<TeamPanel teamId="team-proj-shellcorp-dev-team" isOpen onOpenChange={() => {}} />
```

## How To Test

- Run targeted Team Panel tests: `npm run test:once -- team-panel`
- Run workspace typecheck: `npm run typecheck`
