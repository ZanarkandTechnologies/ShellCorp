# Office System Module

## Boundaries
- Keep office-object runtime metadata normalized through `office-object-ui.ts`.
- Keep scene movement logic in employee locomotion hooks, not object panels or status hooks.
- Resolve semantic skill activity to scene targets in pure helpers before passing data into React Three Fiber.

## Invariants
- Agent activity targets are keyed by `skillId`, never by persisted office-object IDs.
- Office objects own placement and local runtime UI metadata; status events only report semantic activity.
- Active project team clusters are derived from project/team state, not deletable furniture; builder delete affordances must steer operators toward archive/remove-team flows instead of pretending a cluster delete will remove the underlying team. `MEM-0182`
- Agent memory inspection must stay memory-first: the employee context panel should lead with parsed `MEMORY.md` and `memory/*.md` entries, while broader workspace files or board workflows remain secondary handoffs instead of the default view. `MEM-0191`
- Builder object movement must constrain against the live `officeLayout` tile mask, not the nav-grid snap alone, so newly added floor area becomes immediately usable for placement and drag preview matches persisted placement rules. `MEM-0187`
- Builder object selection should keep the scene radial menu lean (`Move`, `Transform`, `Settings`) and route rotate/scale/delete through the shared transform panel so builder controls do not duplicate across overlays. `MEM-0190`
- Avatar targeting must remain transient and presentation-only; it must not rewrite persisted desk or object transforms.
- Shared skill hosts must fan active avatars across deterministic local slots so multiple agents can occupy one object without overlapping.
- Skill effects must be chosen once per activity from object metadata and remain stable for that activity; render code may not randomize effects per frame or per rerender.

## Tests
- Prefer pure tests for skill-target resolution and metadata parsing.
- Validate locomotion changes with focused unit tests before relying on manual scene checks.

## Conventions
- Major logic files need the standard header block.
- New office-object runtime metadata must remain backward-compatible with existing persisted `metadata`.
