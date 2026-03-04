---
name: status-self-reporter
description: Publish explicit agent progress updates to ShellCorp Convex status backend.
---

# Status Self Reporter

## Goal

Make agent progress observable without relying on message hooks by writing explicit status updates to Convex.

## Inputs

- agentId
- state: planning | executing | blocked | done | running | ok | error | no_work | idle
- statusText (human-readable summary)
- stepKey (stable id for dedupe, e.g. `<agentId>-<taskId>-<phase>`)
- optional skillId
- optional sessionKey

## Outputs

- A `status_report` event in `agentEvents`
- Updated `agentStatus` row (`state`, `statusText`, and bubbles)

## Workflow

1. Resolve Convex site URL:
   - use `SHELLCORP_CONVEX_SITE_URL`
   - fallback to `CONVEX_SITE_URL`
2. Build a compact payload:
   - `agentId`, `state`, `statusText`, `stepKey`
   - add `skillId` and `sessionKey` when known
3. POST to `/status/report`:
   - `POST ${convexSiteUrl}/status/report`
   - `content-type: application/json`
4. If response is not `{ ok: true }`, log the error and retry once with a new `stepKey` suffix.

## Example

```bash
curl -sS "$SHELLCORP_CONVEX_SITE_URL/status/report" -X POST \
  -H "content-type: application/json" \
  -d '{
    "agentId":"buffalos-ai-executor",
    "state":"executing",
    "statusText":"Publishing launch clip to distribution channel",
    "stepKey":"buffalos-ai-executor-task42-executing",
    "skillId":"distribute/affiliate-video-poster"
  }'
```

## Guardrails

- Always report at least:
  - start of turn (`planning`)
  - before major execution (`executing`)
  - when blocked (`blocked`)
  - end of turn (`done` or `ok`)
- Keep `statusText` short and operator-readable.
- Use stable `stepKey` values so duplicates are safely ignored.
