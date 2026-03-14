# Feature: Personalization And Custom Meshes

This page explains how ShellCorp handles office decor, custom mesh assets, and skill-aware office objects.

## Value

- Make the office feel alive and visually distinct without weakening the core operator workflow.
- Keep custom asset usage deterministic and easy to audit.
- Let office objects reflect agent activity through semantic skill bindings instead of hardcoded scene hacks.

## Current Product Shape

Personalization in the current phase is split into two layers:

- `decor`: floor, wall, background, paintings, and office objects managed through the ShellCorp CLI and office UI
- `custom meshes`: operator-provided `.glb` / `.gltf` files that can be imported, previewed, and placed as office objects

Agent appearance and mesh-wrapper flows are part of the broader direction, but the fully generalized operator-facing appearance system is still governed by [SC09](../specs/SC09-spec-agent-personalization-and-mesh-wrapper.md).

## Custom Mesh Asset Flow

The current custom mesh flow is:

1. Put a `.glb` or `.gltf` file in the mesh asset folder.
2. Expose it through a public path such as `/openclaw/assets/meshes/dragon.glb`.
3. Add it to the office through the CLI or import it from the UI.
4. Persist the object with `meshPublicPath` metadata so the office can render it as a real mesh.

ShellCorp intentionally requires explicit mesh metadata for `custom-mesh` objects. If the object has no `meshPublicPath`, it is treated as invalid rather than silently rendering as a placeholder.

## Where To Put GLB Files

Current local folder convention:

- `~/.openclaw/assets/meshes`

Current public path convention:

- `/openclaw/assets/meshes/<file>.glb`
- `/openclaw/assets/meshes/<file>.gltf`

Example:

- local file: `~/.openclaw/assets/meshes/dragon.glb`
- public path used by ShellCorp: `/openclaw/assets/meshes/dragon.glb`

The UI import flow and office commands already assume this pattern.

## Preview Convention

You can add a lightweight preview image beside the mesh file:

- `chair.glb`
- `chair.preview.png`

This is the current catalog convention used by the furniture/import UI.

## CLI Examples

```bash
shellcorp office add custom-mesh \
  --auto-place \
  --mesh-public-path /openclaw/assets/meshes/dragon.glb \
  --display-name "Dragon"
```

```bash
shellcorp office doctor --reason missing_mesh_public_path
shellcorp office doctor --fix
```

## UI Import Flow

The office furniture/import UI supports:

- downloading `.glb` / `.gltf` files from a URL into the mesh folder
- saving the mesh folder path
- recognizing same-folder preview images using the `*.preview.png` convention

This keeps the asset flow simple and local-first.

## Skill-Bound Office Objects

ShellCorp also supports semantic skill bindings for office objects.

The important model is:

- agents report activity with a `skillId`
- office objects may declare that they host that skill
- the UI resolves `skillId -> object anchor` at render time
- active agents can visually snap or project near the matching object while the underlying agent/runtime state stays unchanged

This means skill activity is bound to a semantic skill id, not to a hardcoded object id. Operators can rearrange the office without breaking the activity model.

## What This Does Not Do

- It does not make personalization a runtime dependency for OpenClaw.
- It does not block sessions, routing, or heartbeat execution if an asset is missing.
- It does not currently provide a fully generalized asset marketplace or cross-instance asset sync.

## Related Docs

- [feature-decorations.md](./feature-decorations.md)
- [feature-cli.md](./feature-cli.md)
- [architecture.md](./architecture.md)
- [SC09-spec-agent-personalization-and-mesh-wrapper.md](../specs/SC09-spec-agent-personalization-and-mesh-wrapper.md)

