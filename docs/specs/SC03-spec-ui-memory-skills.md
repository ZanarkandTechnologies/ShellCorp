# SC03: UI Memory and Skills Surfaces

## Scope

Upgrade UI memory and skill visibility for multi-agent operations while preserving the existing office/game visualization stack.

## Canonical References

- OpenClaw Multi-Agent Routing: https://docs.openclaw.ai/concepts/multi-agent#multi-agent-routing
- OpenClaw Plugins: https://docs.openclaw.ai/tools/plugin#plugins

## Memory Surface Requirements

- Per-agent memory summary cards
- Session recency and activity signals
- Read-only timeline of recent decisions/events per agent
- Optional plugin-provided memory metadata support

## Skills Surface Requirements

- Shared vs per-agent skill inventory
- Skill source path visibility (workspace skill folder vs shared folder)
- Last sync/refresh timestamp
- Quick filters by agent and skill category

## Data Dependencies

- OpenClaw state adapter layer for agent/session joins
- Optional plugin metadata for richer skill and memory descriptors

## Acceptance Criteria

- UI renders memory and skills with no Convex dependency.
- Memory and skills views support at least one multi-agent setup.
- Panels can refresh from live OpenClaw-backed data.
