# Convex Status Reporting (Self-Report First)

This runbook configures ShellCorp status tracking using agent self-reports to Convex. Hook-based message inference is optional diagnostics only and is disabled by default for production status.

## 1) Set environment variables

In your OpenClaw gateway/agent environment:

- `SHELLCORP_CONVEX_SITE_URL=https://<your-deployment>.convex.site`

Self-report tooling uses `SHELLCORP_CONVEX_SITE_URL` first, then `CONVEX_SITE_URL` as fallback.

## 2) Disable legacy status hook path (default)

Use discovery `entries` config and do not enable `shellcorp-status` for primary status:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "shellcorp-status": { "enabled": false }
      }
    }
  }
}
```

Notes:

- Keep hook disabled unless you explicitly want message-level diagnostics.
- Heartbeat/internal execution is not fully represented by `message:*` hook events.

## 3) Report status to Convex

Agents should send explicit status updates to `/status/report`.

```bash
curl -sS "https://<your-deployment>.convex.site/status/report" -X POST \
  -H "content-type: application/json" \
  -d '{
    "agentId":"main",
    "state":"planning",
    "statusText":"Reviewing top-priority backlog item",
    "stepKey":"main-turn-2026-03-04T18:00-planning",
    "source":"agent.self_report"
  }'
```

Expected response:

```json
{"ok":true,"duplicate":false}
```

## 4) Verify in Convex

```bash
npx convex run status:getAgentStatus '{"agentId":"main"}'
```

## 5) Common troubleshooting

- `missing_required_fields`: ensure `agentId`, `state`, `statusText`, and `stepKey` are present.
- `invalid_state:*`: use supported states (`planning`, `executing`, `blocked`, `done`, `running`, `ok`, `error`, `no_work`, `idle`).
- Duplicate rows not appearing: `stepKey` is idempotent; use a new `stepKey` when state changes.
