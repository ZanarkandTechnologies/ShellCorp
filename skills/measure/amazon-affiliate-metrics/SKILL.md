---
name: amazon-affiliate-metrics
description: Read Amazon Associates metrics (clicks, conversions, commissions) and emit structured metric and ledger updates.
---

# Amazon Affiliate Metrics

## Goal

Collect business outcome metrics from Amazon Associates and normalize them for ShellCorp business tracking.

## Preconditions

- A signed-in Amazon Associates session in browser on residential IP.
- Team id is available.
- The agent can run `npm run shell -- ...` commands.

## Inputs

- Team id and project context.
- Reporting window (default: last 24 hours).
- Affiliate tag / account context from slot config.

## Outputs

- Metric payload:
  - clicks
  - ordered_items
  - shipped_items
  - conversion_rate
  - revenue_cents
- Optional funds/ledger entries for realized commission payouts.

## Workflow

1. Open [Amazon Associates UK](https://affiliate-program.amazon.co.uk/home) and navigate to reporting.
2. Select reporting window and extract clicks, ordered/shipped items, conversion, revenue/commission.
3. Convert currency to integer cents.
4. Persist results using team business/resource commands.
5. Log a short summary for PM review.

## Concrete Command Pattern

Use one of these command flows after metrics extraction:

```bash
# Track realized commission as team funds (preferred if funds commands are enabled)
npm run shell -- team funds deposit \
  --team-id "$TEAM_ID" \
  --amount "$COMMISSION_CENTS" \
  --source amazon_associates \
  --note "amazon associates payout $(date -u +%F)"
```

```bash
# Track operational note in team activity timeline
npm run shell -- team bot log \
  --team-id "$TEAM_ID" \
  --agent-id "$AGENT_ID" \
  --type measuring \
  --label "amazon_metrics" \
  --detail "clicks=$CLICKS ordered=$ORDERED shipped=$SHIPPED conv=$CONV revenue_cents=$REV_CENTS"
```

If your current CLI build supports explicit metric add commands, write metric snapshots there as well.

## Guardrails

- Never invent revenue.
- If the dashboard cannot be reached, return a measurable error and do not write metrics.
- Keep source labels explicit (e.g. `amazon_associates`).
- If data looks stale or partial, include that in the log detail and ask PM to retry next heartbeat.
