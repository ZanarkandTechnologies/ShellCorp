# Notion Plugin (Shell Company)

In-repo OpenClaw extension for Notion comments-first agent ingress, outbound page comments, and helper gateway methods.

## Canonical docs

- https://docs.openclaw.ai/concepts/multi-agent#multi-agent-routing
- https://docs.openclaw.ai/tools/plugin#plugins
- [VPS quickstart](../../docs/how-to/notion-plugin-quickstart.md)

## Load in OpenClaw

Add this directory to `plugins.load.paths` in your OpenClaw config, then restart the gateway.

## Plugin ID

- `notion-shell`

## Gateway methods

- `notion-shell.status.update`
- `notion-shell.sources.list`
- `notion-shell.profile.bootstrap`

## Notes

- Channel config is expected under `channels.notion.accounts.<accountId>`.
- Stable inbound webhook URL: `/plugins/notion-shell/webhook`
- Verification challenges are auto-persisted into `plugins.entries.notion-shell.config.webhook.verificationToken` when the first Notion webhook hits the plugin.
- Accepted `comment.created` events retrieve the full comment body from Notion, require the configured wake word by default, and proxy to OpenClaw `/hooks/agent`.
- Keep the bundled FastAPI probe only for payload capture; the production ingress should stay plugin-owned.
