# SC06 Setup Guide: Kanban + Notion (Comments-First)

This runbook now uses a comments-only integration path:

- Internal ShellCorp remains canonical by default.
- Notion is used for comment ingress/egress.
- `notion-shell.tasks.*` methods are deprecated for active onboarding (keep them only for compatibility while migrating workflows to skills).

## Step 1: Load the Notion Plugin in OpenClaw

1. Open your OpenClaw config (`~/.openclaw/openclaw.json`).
2. Add plugin load path pointing to this repo plugin directory.
3. Enable `notion-shell` entry.
4. Set plugin default account id.
5. Set Notion API key under channel account config.
6. Restart OpenClaw gateway.

Minimal config shape:

```json
{
  "plugins": {
    "enabled": true,
    "load": {
      "paths": ["/home/kenjipcx/Zanarkand/ShellCorp/extensions/notion"]
    },
    "entries": {
      "notion-shell": {
        "enabled": true,
        "config": {
          "defaultAccountId": "default"
        }
      }
    }
  },
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

## Step 2: Verify Plugin Load

Run:

```bash
openclaw plugins list
openclaw plugins info notion-shell
```

You should see `notion-shell` loaded and enabled.

## Step 3: Configure In-App (Control Deck)

In the app:

1. Open `Settings` -> `Control Deck (OpenClaw Config)`.
2. Fill:
   - `notion-shell defaultAccountId`
   - `channels.notion.accounts.default.apiKey`
3. Click `Patch Draft From Controls`.
4. Click `Preview Changes`.
5. Enable `confirm config write`.
6. Click `Apply Config`.
7. Click `Load Live Config` to confirm persistence.

## Step 4: Configure SC06 Per Project in Team Panel

1. Open `Team` panel.
2. Go to `Kanban` tab.
3. Set `Canonical` provider:
   - Start with `internal` (recommended default).
4. Use `Provider` filter (`all/internal/notion/vibe/linear`) to inspect task source.
5. Use `Manual Resync` for provider synchronization.

Task cards should show:

- provider badge
- sync state badge (`healthy | pending | conflict | error`)
- optional deep link to provider task

## Step 5: Bootstrap Notion Profile (for deterministic tool metadata)

1. Open `Team` panel -> `Projects` tab.
2. In `Notion Provider Profile`:
   - Enter Notion database id.
   - Optionally enter tool naming prefix.
3. Click `Save Profile`.

This stores a project-scoped provider profile used for stable context-tool metadata generation.

## Step 6: Configure Stable Inbound Webhook URL

Use one stable plugin-owned URL from the start. Do not verify one URL and later change it in Notion.

1. Add plugin webhook config:

```json
{
  "plugins": {
    "entries": {
      "notion-shell": {
        "enabled": true,
        "config": {
          "defaultAccountId": "default",
          "webhook": {
            "path": "/plugins/notion-shell/webhook",
            "targetAgentId": "main"
          }
        }
      }
    }
  }
}
```

2. Add hooks config so the plugin can proxy accepted comments into `/hooks/agent`:

```json
{
  "hooks": {
    "enabled": true,
    "token": "replace_with_dedicated_hook_secret",
    "allowRequestSessionKey": true,
    "allowedSessionKeyPrefixes": ["hook:notion:"],
    "allowedAgentIds": ["main", "hooks"]
  }
}
```

3. Expose the gateway via your public HTTPS ingress.

4. In Notion webhook settings, set:

```text
https://<public-host>/plugins/notion-shell/webhook
```

5. Verify subscription:
   - Notion sends `{"verification_token":"secret_..."}` to that exact URL.
   - The plugin logs that it saw the token.
   - Paste the token into the Notion verification UI.
   - Persist the same token into `plugins.entries.notion-shell.config.webhook.verificationToken`.

## Step 7: Optional Payload Probe

Use the FastAPI probe only if you need live payload fixtures.

1. Keep the same public URL if you proxy traffic through the probe temporarily.
2. Save captured payloads under `tools/notion-webhook-probe/payloads/`.
3. Do not change the webhook URL in Notion after verification unless you are prepared to delete and recreate the subscription.

## Step 8: Validate End-to-End Quickly

1. Create/update a task in ShellCorp Kanban.
2. Confirm it remains internal-canonical by default.
3. Switch canonical to `notion` only when you want external ownership.
4. Run `Manual Resync`.
5. Verify sync state badges update and deep links appear for Notion-backed tasks.

## Notion Comments Provider Status

Yes, you can install and run it now in local/in-repo mode with the stable plugin-owned webhook workflow.

- Outbound Notion comment sending is available through the registered Notion channel plugin.
- Inbound webhook verification and signature validation now happen in the plugin at `/plugins/notion-shell/webhook`.
- Accepted comments are proxied internally into OpenClaw `/hooks/agent`.
- Use the temporary FastAPI probe only for payload discovery or fixture capture.

## Deprecated from Active Onboarding

These methods still exist for compatibility, but are out-of-path for this comments-first slice:

- `notion-shell.tasks.list`
- `notion-shell.tasks.create`
- `notion-shell.tasks.update`
- `notion-shell.tasks.sync`

## References

- OpenClaw Plugins docs: <https://docs.openclaw.ai/tools/plugin#plugins>
- OpenClaw Webhooks docs: <https://docs.openclaw.ai/automation/webhook>
