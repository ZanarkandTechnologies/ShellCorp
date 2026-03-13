# Notion Comment Hook Contract

This document defines the payload normalization and dispatch contract for Notion comment webhooks handled by the in-repo Notion plugin.

## Goal

- Keep the public webhook URL stable and plugin-owned.
- Keep ShellCorp app canonical for workflow orchestration.
- Trigger agent runs from Notion comments only when intent is explicit (wake-word).

## Endpoint Contract

- Public inbound endpoint: `POST /plugins/notion-shell/webhook`
- Public auth model: Notion verification token + `X-Notion-Signature`
- Internal dispatch target: `POST /hooks/agent` with the gateway's configured `hooks.token`

## Phase A Payload Capture Contract

Use `tools/notion-webhook-probe/server.py` only to gather live payload evidence before finalizing transform logic.

Minimum captures expected:

1. Verification challenge body with `verification_token`
2. `comment.created` with wake-word
3. `comment.created` without wake-word
4. Non-comment event payload (for skip verification)

Saved evidence path:

- `tools/notion-webhook-probe/payloads/*.json`

## Expected Notion Fields (normalized)

The transform reads from these field paths when present:

- `type` -> event type (expect `comment.created`)
- `entity.id` -> comment id (preferred)
- `id` -> event id fallback
- `data.page_id` -> Notion page id
- `authors[]` -> author metadata, skip if any author is bot-typed

Comment text extraction order:

1. `data.comment.rich_text[].plain_text`
2. `data.rich_text[].plain_text`
3. `comment.rich_text[].plain_text`
4. Optional live lookup via Notion API using `entity.id` + `NOTION_API_KEY` env var

## Internal OpenClaw Dispatch Mapping

For accepted comments, the plugin dispatches an `agent` hook payload:

- `kind`: `agent`
- `message`: extracted comment text
- `name`: `Notion`
- `agentId`: `main` (override allowed in config mapping)
- `sessionKey`: `hook:notion:page:<pageId>:comment:<commentId>`
- `wakeMode`: `now`
- `deliver`: `true`
- `channel`: `last`

For verification challenge:

- respond `200`
- cache/log the token for operator persistence
- keep the same public URL after verification

For skipped events:

- return `null`

## OpenClaw + Plugin Config Snippet

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
            "targetAgentId": "main",
            "verificationToken": "secret_from_notion_after_verify"
          }
        }
      }
    }
  },
  "hooks": {
    "enabled": true,
    "token": "replace_with_dedicated_hook_secret",
    "defaultSessionKey": "hook:notion:ingress",
    "allowRequestSessionKey": true,
    "allowedSessionKeyPrefixes": ["hook:notion:"],
    "allowedAgentIds": ["main", "hooks"]
  }
}
```

## Verification and Test Commands

Local verification challenge simulation:

```bash
curl -X POST http://127.0.0.1:18789/plugins/notion-shell/webhook \
  -H "content-type: application/json" \
  -d '{"verification_token":"secret_example"}'
```

Signed comment event simulation:

```bash
curl -X POST http://127.0.0.1:18789/plugins/notion-shell/webhook \
  -H "X-Notion-Signature: sha256=<computed_signature>" \
  -H "content-type: application/json" \
  -d '{"type":"comment.created","entity":{"id":"comment123"},"data":{"page_id":"page123","comment":{"rich_text":[{"plain_text":"@shell summarize this"}]}},"authors":[{"type":"person"}]}'
```

## Troubleshooting

- `401 invalid_signature`: wrong/missing `X-Notion-Signature` or stale verification token
- `400 invalid payload`: malformed JSON body
- `202` but no useful output: event skipped because of missing wake-word, bot author, or unsupported type
- no run triggered: missing wake-word or bot-authored comment skipped
- dispatch failure mentioning `hooks.allowRequestSessionKey`: enable request session keys and allow the `hook:notion:` prefix
