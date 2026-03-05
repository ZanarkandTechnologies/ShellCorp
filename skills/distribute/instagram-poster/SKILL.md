---
name: instagram-poster
description: Publish short-form affiliate content to Instagram Reels with attribution metadata and failure-safe logging.
---

# Instagram Poster

## Goal

Publish a prepared short-form asset to Instagram Reels and record enough metadata for later performance attribution.

## Preconditions

- Asset exists in workspace and is in Reel-compatible format.
- Caption, hashtags, and CTA link are prepared.
- Instagram session is authenticated (browser flow) or API credentials are available.

## Inputs

- Video asset path.
- Caption text and hashtags.
- CTA/affiliate link context.
- Team id, task id, and agent id.

## Outputs

- Publish result (`success` or `failure`).
- Post URL/ID when successful.
- Activity and board updates in ShellCorp.

## Workflow

1. Validate asset format and duration for Reels.
2. Publish via browser flow (default) or API when available.
3. Capture post URL/ID and store in task notes/activity detail.
4. Mark task done and log distribution event.

## Concrete Command Pattern

```bash
npm run shell -- team bot log \
  --team-id "$TEAM_ID" \
  --agent-id "$AGENT_ID" \
  --type distributing \
  --label "instagram_posted" \
  --detail "post_url=$POST_URL campaign=$CAMPAIGN_ID task=$TASK_ID"
```

```bash
npm run shell -- team board task done \
  --team-id "$TEAM_ID" \
  --task-id "$TASK_ID" \
  --actor-agent-id "$AGENT_ID"
```

On failure:

```bash
npm run shell -- team board task block \
  --team-id "$TEAM_ID" \
  --task-id "$TASK_ID" \
  --reason "instagram_publish_failed:$ERROR_CODE" \
  --actor-agent-id "$AGENT_ID"
```

## Guardrails

- Do not repost the same asset unless explicitly requested by task.
- Always include CTA link context in caption plan.
- If login/session is invalid, block task with exact failure reason.
