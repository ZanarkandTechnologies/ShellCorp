# SC11: Affiliate Marketing MVP — Full Autonomous Agent Loop

## Scope

Define the end-to-end autonomous affiliate marketing business operated by a PM + Executor agent pair: product research, content creation (video/image via inference.sh), distribution (TikTok/Instagram), and revenue measurement (Amazon Associates). This spec covers the agent workflow loop, concrete skill contracts with CLI commands, cold-start protocol, budget tracking, and the operator visibility surface.

## Canonical References

- OpenClaw Heartbeat: https://docs.openclaw.ai/gateway/heartbeat
- OpenClaw Hooks: https://docs.openclaw.ai/automation/hooks
- Amazon Associates UK: https://affiliate-program.amazon.co.uk/home
- Amazon Affiliate Product Discovery: https://www.amazon.co.uk/b?node=59321051031
- inference.sh CLI: https://inference.sh/docs/apps/running
- `SC10`: `docs/specs/SC10-spec-heartbeat-autonomy-loop.md`
- `SC06`: `docs/specs/SC06-spec-kanban-federation-sync.md`
- Decisions log: `docs/autonomous-business-mvp-decisions.md`

## Product Rules

- Every content asset must include a trackable affiliate link in caption/bio.
- Agents must never fabricate revenue or metrics — if a dashboard is unreachable, report the error and skip.
- Inference.sh API costs must be logged as spend via `team funds spend` after each call.
- Agents must not post duplicate content unless the task explicitly requests reposting.
- The PM agent plans; the Executor agent executes. Neither role crosses into the other.
- On cold start (empty board), PM must create research tasks before any content creation.
- All file artifacts (videos, images, scripts) are saved to the agent's workspace filesystem.

## Data Contracts

### ContentBrief

- `briefId`
- `projectId`
- `productName`
- `productUrl`
- `affiliateLink`
- `affiliateTag`
- `angle`: hook / value prop / CTA strategy
- `targetPlatform`: `tiktok | instagram | youtube_shorts`
- `constraints`: duration, aspect ratio, text limits
- `status`: `draft | approved | in_production | published`

### AffiliateLink

- `linkId`
- `projectId`
- `productUrl`
- `affiliateTag`
- `shortenedUrl` (optional, e.g. via Bitly)
- `createdAt`

### DistributionRecord

- `recordId`
- `projectId`
- `briefId`
- `platform`: `tiktok | instagram`
- `postUrl`
- `postId`
- `caption`
- `hashtags[]`
- `affiliateLinkUsed`
- `postedAt`
- `experimentId` (optional)

### MetricSnapshot (extends existing MetricEvent)

- `source`: `amazon_associates`
- `metrics`:
  - `clicks`
  - `ordered_items`
  - `shipped_items`
  - `conversion_rate`
  - `revenue_cents`
  - `commission_cents`

## Agent Workflow

### PM Agent Heartbeat Loop

```
Wake -> Read board state -> Decide action:

  IF board is empty (cold start):
    -> Create "research trending niches" task
    -> Create "find affiliate products" task
    -> Report status: planning

  IF tasks exist but metrics are stale (>24h):
    -> Create "check Amazon metrics" task
    -> Reprioritize content tasks based on last metrics

  IF executor has completed content:
    -> Review output quality
    -> Create distribution task if content is ready
    -> Update experiment tracking

  IF budget is low:
    -> Pause expensive content creation tasks
    -> Prioritize measurement and analysis

  ALWAYS:
    -> Log activity via `team bot log`
    -> Report live state via `team status report`
```

### Executor Agent Heartbeat Loop

```
Wake -> Get next task from board -> Route by task type:

  research:
    -> Browse web for trending products/niches
    -> Find products on Amazon, generate affiliate links
    -> Create content briefs as new board tasks
    -> Log cost: $0 (browsing only)

  create_content:
    -> Read content brief from task
    -> Generate script (hook -> value -> CTA)
    -> Generate video via inference.sh CLI
    -> Save to workspace filesystem
    -> Log cost via `team funds spend`
    -> Mark task done, create distribution task

  distribute:
    -> Read distribution task (video path + caption + link)
    -> Post to TikTok/Instagram via API or browser
    -> Record post URL/ID in distribution record
    -> Mark task done

  measure:
    -> Open Amazon Associates dashboard (browser)
    -> Extract clicks, conversions, revenue
    -> Write metricEvents[] and ledger[] entries
    -> Report findings to PM via activity log

  ALWAYS:
    -> Report status transitions via `team status report`
    -> Move task through board states (in_progress -> done)
```

## Skill Contracts

### 1. Product Researcher (`skills/measure/product-researcher`)

**Purpose:** Discover trending products and generate affiliate links.

**Workflow:**
1. Browse trending product categories on Amazon UK
2. Identify high-commission, high-demand products
3. Generate affiliate link: `https://amazon.co.uk/dp/{ASIN}?tag={affiliateTag}`
4. Create content brief with product details, angle, and target platform
5. Write brief as new board task via `team board task add`

**CLI integration:**
```bash
# Agent uses OpenClaw browser/computer-use to browse Amazon
# Then creates tasks via ShellCorp CLI
shellcorp team board task add \
  --team-id {teamId} \
  --title "Create video: {productName}" \
  --priority high \
  --owner-agent-id {executorAgentId}
```

### 2. Video Generator (`skills/execute/video-generator`)

**Purpose:** Produce short-form video assets using inference.sh.

**Available models (via `infsh` CLI):**

| Use Case | Command | Cost Tier |
|----------|---------|-----------|
| Text-to-video | `infsh app run google/veo-3-1-fast --input '{"prompt": "..."}'` | Medium |
| Image-to-video | `infsh app run falai/wan-2-5 --input '{"image_url": "..."}'` | Medium |
| AI avatar (user's face) | `infsh app run bytedance/omnihuman-1-5 --input '{"image_url": "...", "audio_url": "..."}'` | High |
| Lipsync talking head | `infsh app run falai/fabric-1-0 --input '{"image_url": "...", "audio_url": "..."}'` | Medium |
| Programmatic video | `infsh app run infsh/remotion-render --input '{"code": "...", "duration_seconds": 30}'` | Low |
| Image generation | `infsh app run google/gemini-3-1-flash-image-preview --input '{"prompt": "..."}'` | Low |
| Background removal | `infsh app run infsh/birefnet --input '{"image_url": "..."}'` | Low |
| Video upscaling | `infsh app run falai/topaz-video-upscaler --input '{"video_url": "..."}'` | Medium |
| Merge clips | `infsh app run infsh/media-merger --input '{"videos": ["...", "..."]}'` | Low |

**Setup required:**
```bash
npx skills add inference-sh/skills@agent-tools
infsh login
```

**Workflow:**
1. Read content brief from task
2. Generate script: hook (3s) -> value demo (15s) -> CTA with affiliate link (5s)
3. Choose model based on brief (avatar for UGC, veo for B-roll, remotion for data-driven)
4. Run `infsh app run ...` and save output to workspace
5. Log cost: `shellcorp team funds spend --team-id {id} --amount {cents} --source inference_sh --note "{model}"`

### 3. TikTok Poster (`skills/distribute/tiktok-poster`)

**Purpose:** Publish video content to TikTok.

**Primary path (API, when app is approved):**
- TikTok Content Posting API via OAuth
- Upload video, set caption + hashtags + link-in-bio reference

**Fallback path (browser, until API ready):**
- Use OpenClaw computer-use to upload via TikTok web
- Navigate to tiktok.com/upload, attach file, set caption

**Post-publish:**
- Capture post URL
- Record via `shellcorp team bot log --team-id {id} --agent-id {agentId} --activity-type distributing --label "distributed" --detail "Posted to TikTok: {url}"`

### 4. Instagram Poster (`skills/distribute/instagram-poster`)

**Purpose:** Publish Reels to Instagram.

**Path:** Browser-based via OpenClaw computer-use (Instagram API requires business account + approval).

**Workflow:**
1. Navigate to Instagram web
2. Upload Reel with caption, hashtags, CTA
3. Capture post URL
4. Log distribution record

### 5. Amazon Affiliate Metrics (`skills/measure/amazon-affiliate-metrics`)

**Purpose:** Read earnings and traffic from Amazon Associates dashboard.

**Primary path (browser):**
- Use OpenClaw computer-use to access https://affiliate-program.amazon.co.uk/home
- Navigate to Reports -> Earnings
- Extract: clicks, ordered items, shipped items, conversion rate, revenue

**Future path (webhook):**
- Set up Amazon Associates API or payment webhook as OpenClaw gateway channel
- Automatic ingestion of commission events

**Post-measurement:**
```bash
# Write metric event
shellcorp team business metric-add \
  --team-id {id} \
  --source amazon_associates \
  --metrics '{"clicks":240,"ordered_items":3,"revenue_cents":810}'

# Write revenue to ledger if commission realized
shellcorp team funds deposit \
  --team-id {id} \
  --amount {commissionCents} \
  --source amazon_associates \
  --note "commission payout {date}"
```

## Cold Start Protocol

When a business team is created with zero tasks and no prior history:

1. **PM first heartbeat:** Detects empty board. Creates research task: "Research trending AI tools for affiliate content."
2. **Executor picks up research task:** Browses Amazon trending categories, identifies 3-5 products with good commission rates, generates affiliate links, creates content brief tasks.
3. **PM second heartbeat:** Sees content briefs. Reviews, approves, assigns priorities.
4. **Executor picks up content task:** Generates first video using inference.sh, saves to workspace.
5. **PM third heartbeat:** Sees completed content. Creates distribution task.
6. **Executor distributes:** Posts to TikTok/Instagram with affiliate link in bio/caption.
7. **PM later heartbeat:** Creates measurement task after 24-48h.
8. **Executor measures:** Checks Amazon dashboard, logs metrics and revenue.

After cold start, the loop becomes self-sustaining: PM analyzes what content performs, creates more briefs for winning angles, executor produces and distributes.

## Resource Budget Protocol

| Action | Approximate Cost | Source Label |
|--------|-----------------|--------------|
| inference.sh video gen (veo) | $0.10-0.50/video | `inference_sh` |
| inference.sh image gen | $0.01-0.05/image | `inference_sh` |
| inference.sh avatar | $0.20-0.80/video | `inference_sh` |
| OpenClaw agent turn (Claude) | ~$0.05-0.15/turn | `openai_api` |
| TikTok posting | $0 (API) | `platform_api` |
| Amazon metrics check | $0 (browser) | `browser_ops` |

Budget guardrails from heartbeat:
- If `cash_budget` remaining < 20% of limit -> PM pauses content creation, focuses on measurement
- If `api_quota` remaining < 10 -> PM creates "wait for quota reset" task
- If `distribution_slots` remaining = 0 -> PM schedules for next day

## UI Requirements

- Team Panel Business tab shows capability slot assignments (which inference.sh models are configured)
- Team Panel Kanban tab shows content pipeline: research -> create -> distribute -> measure
- Team Panel Projects tab exposes a project-scoped artefact viewer so operators can browse generated workspace files without terminal navigation
- Team Panel Ledger tab shows real-time P&L: inference.sh costs vs Amazon commission revenue
- Team Panel Activity tab shows agent actions: "Generated video for {product}", "Posted to TikTok", "Checked metrics: 240 clicks"
- Agent status bubbles show current state: planning, researching, generating_video, posting, measuring

## Acceptance Criteria

- PM agent on empty board creates research tasks within first heartbeat.
- Executor agent can generate a video via `infsh app run` and save it to workspace.
- Executor agent can post content to TikTok (API or browser fallback).
- Executor agent can read Amazon Associates dashboard and write metric events.
- All inference.sh costs are logged as spend via `team funds spend`.
- Revenue from commissions appears in ledger via `team funds deposit`.
- Operators can see full content pipeline (research -> create -> distribute -> measure) in Team Panel.
- Budget guardrails prevent overspend when resources are low.
- Two teams can run the same business type in parallel without cross-contamination.
