# Features Overview

ShellCorp provides an operator-facing office control center on top of OpenClaw runtime state.

## Product Value

- Decoration and personalization controls make the office representation actionable and configurable.
- Observability surfaces make team, session, memory, and sync state inspectable.
- Team/business controls tie goals and KPIs to operational execution loops.
- Governance controls keep autonomous work visible, auditable, and interruptible.

## Read Order

1. `docs/getting-started.md`
2. This file (`docs/features-overview.md`)
3. `docs/feature-decorations.md`
4. `docs/feature-cli.md`
5. `docs/feature-business-logic.md`
6. `docs/extensions.md`

## Feature Map

| Feature | Value | Status | Canonical doc | Specs / memory |
| --- | --- | --- | --- | --- |
| Office decorations | Personalize office objects and themes for better team visibility | shipped | `docs/feature-decorations.md` | `MEM-0120` |
| ShellCorp CLI | Operate team topology, heartbeat policy, and office state | shipped | `docs/feature-cli.md` | `MEM-0119`, `MEM-0120` |
| Business logic model | Explain goals/KPIs, hard beats, and team-as-office-object loop | shipped baseline + evolving | `docs/feature-business-logic.md` | `SC06`, `SC07`, `SC10`, `MEM-0114` |
| Extensions | Integrate external systems through plugin-first contracts | shipped baseline | `docs/extensions.md` | `MEM-0102`, `MEM-0117` |
| Kanban federation controls | Canonical provider ownership and sync observability | in_progress | `docs/feature-business-logic.md` | `SC06`, `MEM-0115` |
| Ticket-session lifecycle | Ticket linked to agent session until explicit close/reopen | planned | `docs/feature-business-logic.md` | `SC07`, `MEM-0112` |
| Heartbeat governance panel depth | Rich pause/resume/manual-run loop controls and audit views | planned | `docs/feature-business-logic.md` | `SC10`, `MEM-0114` |

## Where To Go Next

- Commands and operational examples: `docs/feature-cli.md`
- Intent cookbook for agent operation: `docs/how-to/ceo-team-cli-scl-cookbook.md`
- Notion webhook contract: `docs/how-to/notion-comment-hook-contract.md`
