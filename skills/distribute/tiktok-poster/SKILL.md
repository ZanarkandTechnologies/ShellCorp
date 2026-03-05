---
name: tiktok-poster
description: Publish short-form content to TikTok with campaign metadata and link attribution context.
---

# TikTok Poster

## Goal

Distribute a prepared short-form asset to TikTok and record campaign metadata for measurement.

## Preconditions

- TikTok app/API may be pending approval; support both API and browser fallback.
- Video asset exists in workspace and passes TikTok format constraints.
- Affiliate CTA link is available (caption/link-in-bio reference).

## Inputs

- Video asset path
- Caption, hashtags, CTA link
- Campaign and experiment identifiers (if present)

## Outputs

- Publish result (success/failure)
- Platform URL or post id
- Distribution metadata for project tracking

## Workflow

1. Validate asset format for TikTok constraints.
2. Publish with caption + CTA + tracking link (API first, browser fallback).
3. Capture returned post URL/id and store it in task or asset notes.
4. Emit distribution completion summary for PM agent.

## Concrete Command Pattern

Use CLI activity + board logs after posting:

```bash
npm run shell -- team bot log \
  --team-id "$TEAM_ID" \
  --agent-id "$AGENT_ID" \
  --type distributing \
  --label "tiktok_posted" \
  --detail "post_url=$POST_URL campaign=$CAMPAIGN_ID task=$TASK_ID"
```

```bash
npm run shell -- team board task done \
  --team-id "$TEAM_ID" \
  --task-id "$TASK_ID" \
  --actor-agent-id "$AGENT_ID"
```

If posting fails:

```bash
npm run shell -- team board task block \
  --team-id "$TEAM_ID" \
  --task-id "$TASK_ID" \
  --reason "tiktok_publish_failed:$ERROR_CODE" \
  --actor-agent-id "$AGENT_ID"
```

## Guardrails

- Never post the same asset twice unless task explicitly requests reposting.
- Always include the tracking link when provided.
- On failure, capture the exact error and classify as retryable or non-retryable.
- If TikTok API tokens are unavailable, explicitly switch to browser fallback and log that mode.
