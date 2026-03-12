# CEO Team CLI + SCL Cookbook

This guide is the docs-only SCL layer for ShellCorp phase 1.

- **SCL in phase 1** means a command cookbook (intent -> exact CLI command).
- The CEO agent can call ShellCorp CLI commands directly from shell access.

## Runtime Source Of Truth

Commands mutate sidecar files in:

- `~/.openclaw/company.json`
- `~/.openclaw/office-objects.json` (only when team cluster metadata is requested)

## CLI Entry

Run from the ShellCorp repo:

```bash
npm run shell -- <command>
```

Examples:

```bash
npm run shell -- team list
npm run shell -- doctor team-data
```

## SCL Intent Mapping

### 1) Spawn a new team

Intent:

`Create a new team named Alpha with goal/KPIs and role slots.`

Command:

```bash
npm run shell -- team create \
  --name "Alpha" \
  --description "Core product execution team" \
  --goal "Ship alpha roadmap milestones weekly" \
  --kpi weekly_shipped_tickets \
  --kpi closed_vs_open_ticket_ratio \
  --auto-roles builder,pm,growth_marketer
```

### 2) Update team goals/KPIs

Intent:

`Update team Alpha goal and KPI set.`

Command:

```bash
npm run shell -- team update \
  --team-id team-proj-alpha \
  --goal "Reduce backlog while maintaining quality" \
  --kpi-add support_reply_sla_minutes \
  --kpi-remove closed_vs_open_ticket_ratio
```

### 3) Tune role demand

Intent:

`Increase builder capacity for Alpha team.`

Command:

```bash
npm run shell -- team role-slot set \
  --team-id team-proj-alpha \
  --role builder \
  --desired-count 3 \
  --spawn-policy queue_pressure
```

### 4) Update team heartbeat loop guidance

Intent:

`Set a 15-minute team heartbeat for Alpha.`

Command:

```bash
npm run shell -- team heartbeat set \
  --team-id team-proj-alpha \
  --cadence-minutes 15 \
  --goal "Create or execute relevant tickets based on Kanban and team goals" \
  --team-description "Alpha delivery team" \
  --product-details "ShellCorp core platform"
```

### 5) Archive a team

Intent:

`Archive Alpha team and clear demand.`

Command:

```bash
npm run shell -- team archive --team-id team-proj-alpha
```

### 6) Validate integrity

Intent:

`Check that team/project/agent references are valid.`

Command:

```bash
npm run shell -- doctor team-data
```

### 7) Create a founder-review team proposal

Intent:

`Research a new business idea, write a proposal packet, and send it to founder review.`

Command:

```bash
npm run shell -- team proposal create --json-input '{
  "businessType":"affiliate_marketing",
  "requestedBy":"founder",
  "sourceAgentId":"main",
  "ideaBrief":{
    "focus":"affiliate content engine",
    "targetCustomer":"home office shoppers",
    "primaryGoal":"ship weekly revenue-generating content",
    "constraints":"keep spend low and use proven channels"
  },
  "researchSummary":"Creator-led affiliate teams usually need a planning owner, an execution owner, clear acquisition channels, and measurable link tracking.",
  "proposalSummary":"Create a lightweight affiliate team with clear KPI ownership and first-week board items."
}'
```

### 8) Review and execute an approved proposal

Intent:

`Check founder decision status, then create the team from the approved proposal.`

Command:

```bash
npm run shell -- team proposal list --json
npm run shell -- team proposal approve --proposal-id proposal-affiliate-content-engine-team-123 --note "Looks good"
npm run shell -- team proposal execute --proposal-id proposal-affiliate-content-engine-team-123 --json
```

## Machine-Readable Mode

Any command that supports `--json` can be used for agent automation:

```bash
npm run shell -- team list --json
npm run shell -- doctor team-data --json
```
