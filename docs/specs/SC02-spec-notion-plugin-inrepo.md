# SC02: Notion Plugin (In-Repo OpenClaw Extension)

## Scope

Package existing Notion channel/provider logic into an OpenClaw plugin that is developed in this repository and loaded by OpenClaw through extension paths.

## Canonical References

- OpenClaw Plugins: https://docs.openclaw.ai/tools/plugin#plugins
- OpenClaw Multi-Agent Routing: https://docs.openclaw.ai/concepts/multi-agent#multi-agent-routing

## Source Inputs

- `src/channels/notion.ts`
- `src/providers/notion.ts`
- `src/channels/base.ts`
- `src/providers/base.ts`

## Target Structure

- `extensions/notion/openclaw.plugin.json`
- `extensions/notion/index.ts`
- `extensions/notion/README.md`

## MVP Plugin Responsibilities

- Register a Notion channel plugin for inbound/outbound comment workflow.
- Expose minimal helper operations needed by UI/chat bridge.
- Validate plugin config via manifest schema and UI hints.
- Keep wake-word and webhook verification logic from current implementation.

## Config Surface

- Plugin settings under `plugins.entries.<id>.config`.
- Channel config under `channels.<id>` where applicable.
- Document local loading with `plugins.load.paths`.

## Acceptance Criteria

- Plugin is discoverable by OpenClaw.
- Plugin config validates through `openclaw.plugin.json`.
- Notion inbound and outbound behavior is operational in MVP path.
