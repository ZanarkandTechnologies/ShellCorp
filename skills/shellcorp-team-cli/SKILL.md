---
name: shellcorp_team_cli
description: Manage ShellCorp teams with the local shell CLI. Use when an agent already knows the intended team mutation and needs concrete commands for team create/update, board task operations, proposal state changes, heartbeat, business config, or validation.
---

# ShellCorp Team CLI Skill

Use this skill when the needed workflow is already decided and the agent needs command syntax plus mutation guardrails.
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
  --auto-roles builder,pm,growth_marketer
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

- CEO board task metadata for proposal/review work:

```bash
npm run shell -- team board task add \
  --team-id team-proj-buffalos-ai \
  --title "Launch affiliate content team" \
  --task-type team_proposal \
  --approval-state pending_review \
  --linked-session-key agent:main:main \
  --detail "Research summary, proposed roles, and next step"

npm run shell -- team board task update \
  --team-id team-proj-buffalos-ai \
  --task-id task-123 \
  --approval-state approved \
  --created-team-id team-proj-affiliate-content-team \
  --created-project-id proj-affiliate-content-team
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

- Proposal lifecycle for CEO-led team generation:

```bash
npm run shell -- team proposal list --json
npm run shell -- team proposal show --proposal-id proposal-affiliate-content-team-123 --json
npm run shell -- team proposal create --json-input '{"businessType":"affiliate_marketing","requestedBy":"founder","sourceAgentId":"main","ideaBrief":{"focus":"affiliate content engine","targetCustomer":"home office shoppers","primaryGoal":"ship weekly revenue-generating content","constraints":"low spend and proven channels only"}}'
npm run shell -- team proposal approve --proposal-id proposal-affiliate-content-team-123 --note "Looks good"
npm run shell -- team proposal request-changes --proposal-id proposal-affiliate-content-team-123 --note "Need clearer channel strategy"
npm run shell -- team proposal execute --proposal-id proposal-affiliate-content-team-123 --json
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

## Workflow Pairing

For the higher-level CEO workflow that gathers the brief, researches the team shape, prepares the proposal, and only then calls these commands, use:

- [`skills/create-team/SKILL.md`](/home/kenjipcx/Zanarkand/ShellCorp/skills/create-team/SKILL.md)

## Contract Tests

- This skill's executable command examples are covered under [`skills/shellcorp-team-cli/tests/`](/home/kenjipcx/Zanarkand/ShellCorp/skills/shellcorp-team-cli/tests).
- Run them with:

```bash
pnpm run test:skills
```

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
