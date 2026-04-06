# Notion Plugin Quickstart

Fastest path to install the ShellCorp Notion bridge on a VPS and verify the webhook in Notion.

## What this gives you

- stable public Notion webhook at `/plugins/notion-shell/webhook`
- page comments routed into OpenClaw `/hooks/agent`
- default wake word `@shell`
- configurable wake words such as `@lester`

## Prerequisites

- OpenClaw already installed on the VPS
- ShellCorp repo checked out on the VPS
- a public HTTPS host that reaches the OpenClaw gateway
- your Notion integration secret

## 1. Install ShellCorp on the VPS

From the ShellCorp repo:

```bash
pnpm install
pnpm run shell -- onboarding --yes
```

This bootstraps:

- the in-repo `notion-shell` plugin load path
- the plugin entry in `~/.openclaw/openclaw.json`
- OpenClaw hook defaults
- default Notion account config under `channels.notion.accounts.default`

## 2. Add your Notion API key

Put your Notion integration secret in the repo-root `.env.local` before onboarding, or add it directly into `~/.openclaw/openclaw.json` after onboarding.

Example:

```bash
cat >> .env.local <<'EOF'
NOTION_API_KEY=secret_xxx
EOF
```

If onboarding already ran, open `~/.openclaw/openclaw.json` and confirm this shape exists:

```json
{
  "channels": {
    "notion": {
      "accounts": {
        "default": {
          "apiKey": "secret_xxx",
          "requireWakeWord": true,
          "wakeWords": ["@shell"]
        }
      }
    }
  }
}
```

## 3. Set your wake word

To trigger your assistant with `@lester`, change:

```json
{
  "channels": {
    "notion": {
      "accounts": {
        "default": {
          "requireWakeWord": true,
          "wakeWords": ["@lester"]
        }
      }
    }
  }
}
```

You can keep multiple wake words:

```json
"wakeWords": ["@lester", "@shell"]
```

## 4. Start the OpenClaw gateway

Run:

```bash
openclaw gateway
```

Keep it running.

## 5. Determine your webhook URL

If your public gateway host is:

```text
https://your-host.example.com
```

then your Notion webhook URL is:

```text
https://your-host.example.com/plugins/notion-shell/webhook
```

If you are using the Tailscale example from this repo, it is:

```text
https://lester.bicorn-ghoul.ts.net/plugins/notion-shell/webhook
```

## 6. Verify the webhook in Notion

In Notion webhook settings:

1. paste the webhook URL
2. click verify

The plugin will auto-persist the verification token into `~/.openclaw/openclaw.json`.

Read it with:

```bash
jq -r '.plugins.entries["notion-shell"].config.webhook.verificationToken' ~/.openclaw/openclaw.json
```

Paste that token back into Notion if the UI asks for it explicitly.

## 7. Smoke test the bridge

Leave a page comment in Notion:

```text
@lester summarize this page
```

or:

```text
@shell summarize this page
```

Expected behavior:

- Notion sends `comment.created`
- ShellCorp validates the signature
- ShellCorp retrieves the full comment text from Notion
- ShellCorp forwards the message into OpenClaw `/hooks/agent`

## 8. Useful checks

Inspect the Notion bridge config:

```bash
jq '.plugins.entries["notion-shell"]' ~/.openclaw/openclaw.json
```

Inspect the Notion account config:

```bash
jq '.channels.notion.accounts.default' ~/.openclaw/openclaw.json
```

Inspect the hook config:

```bash
jq '.hooks' ~/.openclaw/openclaw.json
```

## Notes

- Keep the production ingress on `/plugins/notion-shell/webhook`
- Do not use the bundled FastAPI probe as the long-lived public endpoint
- Restart the gateway after editing `~/.openclaw/openclaw.json`

## Related docs

- [extensions/notion/README.md](../../extensions/notion/README.md)
- [docs/how-to/sc06-kanban-notion-setup.md](./sc06-kanban-notion-setup.md)
- [docs/how-to/notion-comment-hook-contract.md](./notion-comment-hook-contract.md)
- [docs/how-to/vps-tailscale-shellcorp.md](./vps-tailscale-shellcorp.md)
