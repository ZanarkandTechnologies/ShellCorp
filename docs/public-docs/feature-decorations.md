# Feature: Decorations

ShellCorp office decoration is CLI-first in the current phase.

## Value

- Give teams visual ownership over office space.
- Make topology and workspace identity easier to read.
- Keep personalization changes deterministic through sidecar state.

## Commands

Run from repo root:

```bash
npm run shell -- office print
npm run shell -- office list
npm run shell -- office teams
npm run shell -- office add plant --position -10,0,-10
npm run shell -- office move plant-nw --position 0,0,0
npm run shell -- office remove plant-nw
npm run shell -- office theme
npm run shell -- office theme set cozy
npm run shell -- office generate "small cactus desk plant" --style low-poly --type prop
```

## State Ownership

- Decoration state is persisted in sidecar office objects.
- ID reconciliation between UI-facing IDs and sidecar IDs is required for reliable move/delete flows (`MEM-0115` placement invariant, `MEM-0120` CLI-first decision).

## Meshy Flow

- `office generate ...` captures a Meshy-oriented asset spec.
- Generated specs are staged before optional custom mesh placement.
- Current skill reference: `skills/meshy/skill.md`.

## Related Docs

- CLI details: `docs/feature-cli.md`
- Office decorator skill: `skills/office-decorator/skill.md`
- HISTORY reference: `MEM-0120` in `docs/HISTORY.md`
