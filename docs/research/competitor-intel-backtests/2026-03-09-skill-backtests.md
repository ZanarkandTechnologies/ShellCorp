# Competitor-Intel Skill Backtests

Date: 2026-03-09

Purpose: capture practical cold-start scenario tests for the competitor-intel skills so future revisions can be compared against a saved baseline.

## Backtest Method

- No shared thread context was given to the planning subagents.
- Each run was asked to use:
  - `skills/competitor-feature-scout/watchlist.md`
  - `skills/competitor-feature-scout/SKILL.md`
- Scenarios were hypothetical business contexts, not live repo diffs.

## Scenario 1: Affiliate Marketing Team

Competitor changes:

- per-channel ROI dashboard with spend caps
- experiment history tied to content assets
- automatic low-performing-campaign pause

Returned recommendations:

- `adapt`: per-channel ROI dashboard with spend caps
- `adapt`: experiment history tied to content assets
- `watch`: automatic low-performing-campaign pause

Why this result is good:

- It reused existing ShellCorp business primitives (`ledger`, metrics, experiments, artifacts) instead of inventing a separate marketing dashboard model.
- It resisted hard automation where attribution is noisy and governance matters.

Saved example board tasks:

1. `Add channel-attributed ROI + spend-cap policies for affiliate teams`
2. `Link experiment history to content assets and published posts`
3. `Ship low-performance guardrails as recommendation-first, not auto-pause`

## Scenario 2: Client-Service Agency Team

Competitor changes:

- SLA-aware inbox triage
- project-scoped customer thread ownership
- automatic escalation after 4 hours unanswered

Returned recommendations:

- `adapt`: SLA-aware inbox triage
- `adapt`: project-scoped customer thread ownership
- `watch`: automatic escalation after 4 hours unanswered

Why this result is good:

- It mapped directly onto ShellCorp’s communications, routing, and project lifecycle model.
- It treated the fixed 4-hour timer as policy data, not product truth.

Saved example board tasks:

1. `Add project-scoped client thread ownership and response SLA fields`
2. `Ship SLA-aware Team Communications triage lanes for at-risk and breached client threads`
3. `Add policy-driven unanswered-client escalation automation with project hours and audit trail`

## Scenario 3: Recruiting / Outbound Team

Competitor changes:

- lead enrichment memory cards
- cadence-safe follow-up automation
- reply-priority inbox ranking

Returned recommendations:

- `adapt`: lead enrichment memory cards
- `adapt`: cadence-safe follow-up automation
- `watch`: reply-priority inbox ranking

Why this result is good:

- It adapted “cards” into ShellCorp-native memory artifacts instead of a CRM clone.
- It allowed policy-driven follow-up while rejecting premature ranking on weak telemetry.

Saved example board tasks:

1. `Add outbound lead dossiers to ShellCorp memory + team context`
2. `Ship cadence-safe follow-up policy engine for outbound heartbeat runs`

## Common Patterns Observed

- Good outputs favored `adapt` over direct copying.
- Good outputs converted competitor UX into ShellCorp policy and state changes.
- Good outputs avoided hard automation when governance, attribution, or compliance signals were immature.
- The skill was strongest when competitor features could be mapped onto existing ShellCorp primitives.

## Current Confidence

The skill now appears directionally sound for:

- deciding `adapt | watch | ignore`
- producing bounded follow-up work
- avoiding naive cloning of brittle automation

Remaining implementation-level questions still matter, but they no longer look like skill-design failures:

- canonical storage root
- fetch transport
- exact cron payload wiring
- proposal artifact schema in code
