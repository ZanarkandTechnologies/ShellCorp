# Notion Plugin (Shell Company)

In-repo OpenClaw extension for Notion channel and helper gateway methods.

## Canonical docs

- https://docs.openclaw.ai/concepts/multi-agent#multi-agent-routing
- https://docs.openclaw.ai/tools/plugin#plugins

## Load in OpenClaw

Add this directory to `plugins.load.paths` in your OpenClaw config, then restart the gateway.

## Plugin ID

- `notion-shell`

## Gateway methods

- `notion-shell.status.update`
- `notion-shell.sources.list`

## Notes

- Channel config is expected under `channels.notion.accounts.<accountId>`.
- This is an MVP scaffold and can be expanded with richer inbound comment streaming.
