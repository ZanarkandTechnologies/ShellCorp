---
name: product-researcher
description: Research trending products for affiliate marketing and create structured content tasks with trackable affiliate links.
---

# Product Researcher

## Goal

Find products worth promoting, generate affiliate links, and hand off clear content briefs to the executor through the team board.

## Preconditions

- Access to Amazon Associates account and affiliate tag.
- Web browsing/computer-use access.
- Team id and executor agent id known.

## Inputs

- Business goal and KPI targets.
- Allowed niches or exclusions.
- Affiliate tag.

## Outputs

- Ranked shortlist of products.
- Affiliate links with tag applied.
- New board tasks containing content brief context.

## Workflow

1. Browse trend sources and Amazon category pages.
2. Evaluate products by demand signal, commission potential, and content angle fit.
3. Generate affiliate links: `https://amazon.co.uk/dp/{ASIN}?tag={AFFILIATE_TAG}`.
4. Create one task per selected product with title, angle, and CTA context.
5. Log research summary for PM review.

## Concrete Command Pattern

```bash
npm run shell -- team board task add \
  --team-id "$TEAM_ID" \
  --title "Create affiliate video: $PRODUCT_NAME" \
  --priority high \
  --owner-agent-id "$EXECUTOR_AGENT_ID"
```

```bash
npm run shell -- team bot log \
  --team-id "$TEAM_ID" \
  --agent-id "$AGENT_ID" \
  --type research \
  --label "product_research_complete" \
  --detail "selected=$PRODUCT_COUNT top_product=$TOP_PRODUCT"
```

## Guardrails

- Never create links without explicit affiliate tag.
- Do not choose products that violate platform policies.
- If product viability is uncertain, set task priority to medium and include uncertainty in detail.
