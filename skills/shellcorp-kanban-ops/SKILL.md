---
name: shellcorp_kanban_ops
description: Internal Kanban operations skill for agent task execution and status reporting through ShellCorp CLI.
---

# ShellCorp Kanban Ops Skill

Use this skill when an agent should only operate the team board and report progress, not perform full team administration.

## Entry Command

Run from ShellCorp repo root:

```bash
npm run shell -- <command>
```

## Core Loop

1. Pull queue state:

```bash
npm run shell -- team board task list --team-id team-proj-<slug> --json
```

1. Claim/update task:

```bash
npm run shell -- team board task assign --team-id team-proj-<slug> --task-id <taskId> --owner-agent-id <agentId>
npm run shell -- team board task move --team-id team-proj-<slug> --task-id <taskId> --status in_progress
```

1. Log progress/status:

```bash
export SHELLCORP_AGENT_ID=<agentId>
export SHELLCORP_TEAM_ID=team-proj-<slug>

npm run shell -- status \
  --state executing \
  --task-id <taskId> \
  --step-key <idempotencyKey> \
  "Execution update: what changed"
```

1. Finish or block:

```bash
npm run shell -- team board task done --team-id team-proj-<slug> --task-id <taskId> --note "completed output"
npm run shell -- team board task block --team-id team-proj-<slug> --task-id <taskId> --reason "blocked reason"
```

## Full Internal Board Command Set

- Create: `team board task add`
- Update fields: `team board task update`
- Move status: `team board task move`
- Assign owner: `team board task assign`
- Reprioritize: `team board task reprioritize`
- Block/unblock: `team board task block`, `team board task reopen`
- Complete: `team board task done`
- Delete: `team board task delete`
- List: `team board task list`
- Timeline/next: `team bot timeline`, `team bot next`

## Permission-Aware Execution

Use least-privilege role/permissions:

- `SHELLCORP_ACTOR_ROLE` (example: `biz_executor`)
- `SHELLCORP_ALLOWED_PERMISSIONS` (example: `team.read,team.board.write,team.activity.write`)

If denied, CLI returns:

- `permission_denied:<permission>:role=<role>`

## Safety

- Always include `--team-id`.
- Use `--json` when output is consumed by another tool.
- Use `status` with `SHELLCORP_AGENT_ID` + `SHELLCORP_TEAM_ID` exported in-shell.
- Use `--step-key` for idempotent status logs.
- Prefer `task update` over delete/recreate so history stays auditable.
