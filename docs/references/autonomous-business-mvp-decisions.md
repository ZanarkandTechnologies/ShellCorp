# Autonomous Business MVP Decisions

## Why This Exists

This document captures the technical decisions and implementation details for the autonomous business MVP framework added to ShellCorp.

For the full affiliate marketing agent workflow spec (product research, video gen, distribution, metrics), see `SC11`: `docs/specs/SC11-spec-affiliate-marketing-mvp.md`.

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

### 8) Team Command Board Is Convex-Canonical

Business kanban/task execution state now uses Convex as canonical storage for team-isolated command boards:

- `teamBoardTasks` for current task state
- `teamBoardEvents` for append-only lifecycle events
- `agentEvents` (with `activityType` metadata) for both activity timeline and live status reduction

CLI and UI surfaces read/write these Convex tables directly for realtime visibility. Sidecar `company.json.tasks` is no longer canonical for business team board execution flow.

Status visibility uses a companion explicit self-report path:

- `shellcorp status` writes canonical live state and timeline breadcrumbs through one unified event path.
- `shellcorp team status report` and `shellcorp team bot log` remain compatibility commands.

Both should be emitted in heartbeat turns: one for current state, one for event history.

### 9) Business Flow Composer + Dedicated Ledger Tab

Business operations and finance are now intentionally separated in Team Panel:

- `Business` tab:
  - flow composer (plan -> execute -> review/measure -> distribute)
  - capability skill slot assignment (`measure`, `execute`, `distribute`)
  - readiness checklist + heartbeat preview controls
- `Ledger` tab:
  - current account balance
  - funding/spend actions
  - append-only transaction timeline

This keeps operating logic and money movement distinct while preserving one command center.

### 10) First-Class Team Account Contract

Each project now supports:

- `account`:
  - `id`
  - `projectId`
  - `currency`
  - `balanceCents`
  - `updatedAt`
- `accountEvents[]`:
  - append-only `credit | debit` entries
  - source, note, amount, and post-event running balance

`ledger[]` remains available for compatibility and historical P&L views.

## Implemented Commands

### Team create with business mode

```bash
shellcorp team create \
  --name "Affiliate Team" \
  --description "Affiliate business" \
  --goal "Reach $100 MRR" \
  --business-type affiliate_marketing
```

### Update business capability slot

```bash
shellcorp team business set \
  --team-id team-proj-affiliate-team \
  --slot measure \
  --skill-id stripe-revenue \
  --config-json '{"apiKey":"sk_test"}'
```

### Update team resources

```bash
shellcorp team resources set \
  --team-id team-proj-affiliate-team \
  --type cash_budget \
  --remaining 4200 \
  --limit 5000
```

### Seed demo business data

```bash
shellcorp team business seed-demo --team-id team-proj-affiliate-team
```

### Team funds CLI

```bash
# read current team account balance
shellcorp team funds balance --team-id team-proj-affiliate-team

# add money (amount in cents)
shellcorp team funds deposit \
  --team-id team-proj-affiliate-team \
  --amount 50000 \
  --source seed_capital \
  --note "initial funding"

# record spend (amount in cents)
shellcorp team funds spend \
  --team-id team-proj-affiliate-team \
  --amount 1200 \
  --source openai_api \
  --note "content batch run"

# view recent account events
shellcorp team funds ledger --team-id team-proj-affiliate-team --limit 10

# status + timeline reporting during heartbeat turns
shellcorp team status report \
  --team-id team-proj-affiliate-team \
  --agent-id affiliate-pm \
  --state planning \
  --status-text "Reviewing board and resource constraints" \
  --step-key hb-affiliate-pm-001

shellcorp team bot log \
  --team-id team-proj-affiliate-team \
  --agent-id affiliate-pm \
  --activity-type status \
  --label heartbeat_decision \
  --detail "Prioritize low-cost distribution tasks"
```

## UI Surfaces Added

- Team panel now includes a **Business** tab with:
  - flow-based capability composer
  - slot skill library
  - readiness checklist + save/preview controls
- Team panel now includes a dedicated **Ledger** tab with:
  - account summary (balance + deltas)
  - funding/spend action controls
  - append-only account event timeline
- Team creation form now supports:
  - business type
  - capability slot skill ids
  - standard or business-mode team creation

## Files Touched (Primary)

- `cli/sidecar-store.ts`
- `cli/team-commands.ts`
- `ui/src/lib/openclaw-types.ts`
- `ui/src/lib/openclaw-adapter.ts`
- `ui/src/features/team-system/components/business-flow/*`
- `ui/src/providers/office-data-provider.tsx`
- `ui/src/features/team-system/components/team-panel.tsx`
- `ui/src/components/hud/create-team-form.tsx`
- `ui/src/components/hud/create-team-panel.tsx`
- `ui/src/components/hud/organization-panel.tsx`
- `ui/vite.config.ts`
- `templates/sidecar/company.template.json`
