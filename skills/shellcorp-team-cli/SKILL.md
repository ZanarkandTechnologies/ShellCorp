---
name: shellcorp_team_cli
description: Manage ShellCorp teams with the local shell CLI (create, update, role slots, heartbeat, validation).
---

# ShellCorp Team CLI Skill

Use this skill when the user asks to create or manage teams in ShellCorp.
It is CLI-first and permission-aware for agent execution.

## Command Entry

Run commands from the ShellCorp repo root:

```bash
npm run shell -- <command>
```

## Supported Operations

- List teams:

```bash
npm run shell -- team list
```

- Create a team:

```bash
npm run shell -- team create \
  --name "Buffalos AI" \
  --description "Team focused on Minecraft mod generation" \
  --goal "Generate and ship high-quality Minecraft mods" \
  --kpi weekly_shipped_tickets \
  --kpi closed_vs_open_ticket_ratio \
  --auto-roles builder,pm,growth_marketer \
  --with-cluster
```

- Update team details/KPIs:

```bash
npm run shell -- team update \
  --team-id team-proj-buffalos-ai \
  --goal "Reduce backlog while preserving quality" \
  --kpi-add support_reply_sla_minutes \
  --kpi-remove closed_vs_open_ticket_ratio
```

- Show full team snapshot:

```bash
npm run shell -- team show --team-id team-proj-buffalos-ai --json
```

- Replace or clear KPI sets:

```bash
npm run shell -- team kpi set \
  --team-id team-proj-buffalos-ai \
  --kpi weekly_shipped_tickets \
  --kpi net_profit

npm run shell -- team kpi clear --team-id team-proj-buffalos-ai
```

- Bulk update business slots:

```bash
npm run shell -- team business set-all \
  --team-id team-proj-buffalos-ai \
  --business-type affiliate_marketing \
  --measure-skill-id amazon-affiliate-metrics \
  --execute-skill-id video-generator \
  --distribute-skill-id tiktok-poster
```

- Kanban task lifecycle (internal board):

```bash
npm run shell -- team board task add --team-id team-proj-buffalos-ai --title "Draft offer page"
npm run shell -- team board task update --team-id team-proj-buffalos-ai --task-id task-123 --title "Draft offer page v2" --detail "include KPI note"
npm run shell -- team board task move --team-id team-proj-buffalos-ai --task-id task-123 --status in_progress
npm run shell -- team board task done --team-id team-proj-buffalos-ai --task-id task-123
npm run shell -- team board task delete --team-id team-proj-buffalos-ai --task-id task-123
```

- Agent status + ops timeline:

```bash
export SHELLCORP_AGENT_ID=buffalos-ai-pm
export SHELLCORP_TEAM_ID=team-proj-buffalos-ai

npm run shell -- status \
  --state planning \
  "Working queue triage: prioritized top 3 tasks"

npm run shell -- team bot timeline --team-id team-proj-buffalos-ai --json
```

- Set role-slot demand:

```bash
npm run shell -- team role-slot set \
  --team-id team-proj-buffalos-ai \
  --role builder \
  --desired-count 2 \
  --spawn-policy queue_pressure
```

- Set heartbeat policy:

```bash
npm run shell -- team heartbeat set \
  --team-id team-proj-buffalos-ai \
  --cadence-minutes 15 \
  --goal "Create or execute relevant tickets based on Kanban and team goals"
```

- Archive a team:

```bash
npm run shell -- team archive --team-id team-proj-buffalos-ai
```

- Validate data integrity:

```bash
npm run shell -- doctor team-data
```

## Safety Rules

- Never pass untrusted raw user strings directly into shell commands without quoting.
- Prefer fixed command templates and validated flags.
- For automation/parsing, use `--json` where available.
- Mutating commands require permissions. If denied, CLI returns:
  - `permission_denied:<permission>:role=<role>`

## Permission Model (Agent Runtime)

- Optional role input:
  - `SHELLCORP_ACTOR_ROLE` (example: `operator`, `pm`, `readonly`)
- Optional explicit permission override:
  - `SHELLCORP_ALLOWED_PERMISSIONS` (comma-separated list or `*`)
- Common mutation permission keys:
  - `team.meta.write`
  - `team.kpi.write`
  - `team.business.write`
  - `team.resources.write`
  - `team.board.write`
  - `team.activity.write`
  - `team.heartbeat.write`
  - `team.archive`
