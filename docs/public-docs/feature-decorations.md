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
npm run shell -- office add plant --auto-place
npm run shell -- office add custom-mesh --auto-place --mesh-public-path /openclaw/assets/meshes/dragon.glb --display-name "Dragon"
npm run shell -- office add team-cluster --auto-place --metadata name=Dragons
npm run shell -- office doctor
npm run shell -- office doctor --fix
npm run shell -- office move plant-nw --position 0,0,0
npm run shell -- office remove plant-nw
npm run shell -- office theme
npm run shell -- office theme set cozy
npm run shell -- office generate "small cactus desk plant" --style low-poly --type prop
```

## State Ownership

- Decoration state is persisted in sidecar office objects.
- ID reconciliation between UI-facing IDs and sidecar IDs is required for reliable move/delete flows (`MEM-0115` placement invariant, `MEM-0120` CLI-first decision).
- Placement is collision-safe in CLI flows: `office add` supports deterministic `--auto-place`, and both `add`/`move` reject occupied destinations.
- `custom-mesh` placement is strict: mesh URL/path metadata is required to avoid non-renderable placeholders.
- `team-cluster` placement ensures a real project-backed team mapping, so the cluster appears in UI as an actual team.
- `office doctor` can detect invalid persisted objects and `office doctor --fix` can clean them up in one command.

## Meshy Flow

- `office generate ...` captures a Meshy-oriented asset spec.
- Generated specs are staged before optional custom mesh placement.
- Current skill reference: `skills/meshy/skill.md`.
- For concrete mesh file placement, path conventions, and preview-image rules, see [feature-personalization.md](./feature-personalization.md).

## Related Docs

- CLI details: `docs/public-docs/feature-cli.md`
- Personalization and custom assets: `docs/public-docs/feature-personalization.md`
- Office decorator skill: `skills/office-decorator/skill.md`
- HISTORY reference: `MEM-0120` in `docs/HISTORY.md`
