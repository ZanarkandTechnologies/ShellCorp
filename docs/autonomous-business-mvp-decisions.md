# Autonomous Business MVP Decisions

## Why This Exists

This document captures the technical decisions and implementation details for the autonomous business MVP framework added to ShellCorp.

## Core Decisions

### 1) Team Structure: Always PM + Executor

Business teams now use:

- `biz_pm`: monitors KPIs, manages kanban, tracks profitability, and course-corrects.
- `biz_executor`: executes production/distribution tasks and reports measurements.

This enforces management and execution separation while keeping setup simple.

### 2) Business Adapter Model

Each project can define:

- `businessConfig.type` (e.g. `affiliate_marketing`)
- capability slots:
  - `measure`
  - `execute`
  - `distribute`

Each slot references a skill id and optional config.

### 3) Skills by Capability Category

Skills are organized by category, not business vertical:

- `skills/measure/*`
- `skills/execute/*`
- `skills/distribute/*`
- `skills/cross-cutting/*`

This supports future business experimentation by swapping slot skill ids without rewriting framework code.

### 4) Financial + Experiment Data in Sidecar

Each project tracks:

- `ledger[]` (revenue/cost entries in cents)
- `experiments[]` (hypothesis + status + results)
- `metricEvents[]` (time-series metric snapshots)

No external database was introduced for MVP.

### 5) HEARTBEAT Templates in Workspace Templates Directory

Templates live at:

- `templates/workspace/HEARTBEAT-biz-pm.md`
- `templates/workspace/HEARTBEAT-biz-executor.md`

On business team creation, these are copied to each business agent workspace as `HEARTBEAT.md`.

### 6) Heartbeat Scheduling via OpenClaw Cron Jobs

On business team creation, cron jobs are upserted under `~/.openclaw/cron/jobs.json`:

- PM loop job
- Executor loop job

Both run every 3 minutes (`everyMs: 180000`) with isolated sessions and `agentTurn` payloads.

### 7) Advisory Resource Layer

Business projects now support advisory resource modeling with:

- `resources[]`
- `resourceEvents[]`

Initial resource types in this slice:

- `cash_budget`
- `api_quota`
- `distribution_slots`
- `custom`

This layer is advisory-only (no hard executor blocking in MVP). Heartbeats consume resource snapshots for planning and prioritization.

## Implemented Commands

### Team create with business mode

```bash
npm run shell -- team create \
  --name "Affiliate Team" \
  --description "Affiliate business" \
  --goal "Reach $100 MRR" \
  --business-type affiliate_marketing
```

### Update business capability slot

```bash
npm run shell -- team business set \
  --team-id team-proj-affiliate-team \
  --slot measure \
  --skill-id stripe-revenue \
  --config-json '{"apiKey":"sk_test"}'
```

### Update team resources

```bash
npm run shell -- team resources set \
  --team-id team-proj-affiliate-team \
  --type cash_budget \
  --remaining 4200 \
  --limit 5000
```

### Seed demo business data

```bash
npm run shell -- team business seed-demo --team-id team-proj-affiliate-team
```

## UI Surfaces Added

- Team panel now includes a **Business** tab with:
  - Revenue / Cost / Profit cards
  - capability slot display
  - experiments list
  - recent metric events
- Team creation form now supports:
  - business type
  - capability slot skill ids
  - standard or business-mode team creation

## Files Touched (Primary)

- `cli/sidecar-store.ts`
- `cli/team-commands.ts`
- `ui/src/lib/openclaw-types.ts`
- `ui/src/lib/openclaw-adapter.ts`
- `ui/src/providers/office-data-provider.tsx`
- `ui/src/features/team-system/components/team-panel.tsx`
- `ui/src/components/hud/create-team-form.tsx`
- `ui/src/components/hud/create-team-panel.tsx`
- `ui/src/components/hud/organization-panel.tsx`
- `ui/vite.config.ts`
- `templates/sidecar/company.template.json`
