# Features Overview

ShellCorp provides an operator-facing office control center on top of OpenClaw runtime state.

## Product Value

- Decoration and personalization controls make the office representation actionable and configurable.
- Observability surfaces make team, session, memory, and sync state inspectable.
- Team/business controls tie goals and KPIs to operational execution loops.
- Governance controls keep autonomous work visible, auditable, and interruptible.

## Read Order

1. `docs/public-docs/getting-started.md`
2. This file (`docs/public-docs/features-overview.md`)
3. `docs/public-docs/feature-cli.md`
4. `docs/public-docs/feature-teams-heartbeats.md`
5. `docs/public-docs/feature-business-logic.md`
6. `docs/public-docs/feature-personalization.md`
7. `docs/public-docs/feature-decorations.md`
8. `docs/public-docs/feature-meta-improvement.md`
9. `docs/public-docs/extensions.md`

## Feature Map

| Feature | Value | Status | Canonical doc | Specs / memory |
| --- | --- | --- | --- | --- |
| ShellCorp CLI | Operate team topology, heartbeat policy, and office state | shipped | `docs/public-docs/feature-cli.md` | `MEM-0119`, `MEM-0120` |
| Teams, workspaces, and heartbeats | Explain how ShellCorp provisions OpenClaw agents, workspaces, and scheduled execution loops | shipped baseline | `docs/public-docs/feature-teams-heartbeats.md` | `MEM-0124`, `SC10` |
| Business logic model | Explain goals, KPIs, hard beats, and the team execution loop | shipped baseline + evolving | `docs/public-docs/feature-business-logic.md` | `SC06`, `SC07`, `SC10`, `MEM-0114` |
| Personalization and custom meshes | Explain custom mesh placement, asset conventions, and skill-aware office object bindings | shipped baseline + evolving | `docs/public-docs/feature-personalization.md` | `SC09`, `MEM-0173` |
| Office decorations | Personalize office objects and themes for better team visibility | shipped | `docs/public-docs/feature-decorations.md` | `MEM-0120`, `MEM-0169` |
| Meta improvement loop | Watch competitor repos, propose ShellCorp-native adoption work, and feed the CEO workflow | planned scaffold | `docs/public-docs/feature-meta-improvement.md` | `MEM-0152` |
| Extensions | Integrate external systems through plugin-first contracts | shipped baseline | `docs/public-docs/extensions.md` | `MEM-0102`, `MEM-0117` |
| Kanban federation controls | Canonical provider ownership and sync observability | in_progress | `docs/public-docs/feature-business-logic.md` | `SC06`, `MEM-0115` |
| Ticket-session lifecycle | Ticket linked to agent session until explicit close/reopen | planned | `docs/public-docs/feature-business-logic.md` | `SC07`, `MEM-0112` |
| Heartbeat governance panel depth | Rich pause/resume/manual-run loop controls and audit views | planned | `docs/public-docs/feature-teams-heartbeats.md` | `SC10`, `MEM-0114` |

## Where To Go Next

- Commands and operational examples: `docs/public-docs/feature-cli.md`
- Teams and heartbeat model: `docs/public-docs/feature-teams-heartbeats.md`
- Personalization and custom assets: `docs/public-docs/feature-personalization.md`
- CEO/meta-improvement workflow: `docs/public-docs/feature-meta-improvement.md`
- Intent cookbook for agent operation: `docs/how-to/ceo-team-cli-scl-cookbook.md`
- Notion webhook contract: `docs/how-to/notion-comment-hook-contract.md`
