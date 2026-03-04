---
name: shellcorp_team_cli
description: Manage ShellCorp teams with the local shell CLI (create, update, role slots, heartbeat, validation).
---

# ShellCorp Team CLI Skill

Use this skill when the user asks to create or manage teams in ShellCorp.

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

