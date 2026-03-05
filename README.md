# Shell Company

Gamified control center UI for OpenClaw multi-agent operations.

## Start Here

Read in this order:

1. `docs/getting-started.md`
2. `docs/features-overview.md`

## Multi-Agent Heartbeat Proof Loop

Use this to prove every agent can heartbeat and write status via CLI.

### 1) Verify OpenClaw + heartbeat wiring

```bash
openclaw --version
openclaw status
openclaw hooks list
```

Expected:

- `Heartbeat` shows a cadence for each agent (for example `3m (...)`), not `disabled`.
- `shellcorp-status` hook is `ready`.

If non-default agents show `disabled`, add per-agent heartbeat config under `agents.list[].heartbeat` in `~/.openclaw/openclaw.json`.

### 2) Ensure agents have runtime tools

```bash
openclaw config set tools.profile coding
openclaw gateway restart
openclaw config get tools.profile
```

Expected: `coding`

Without this, agents only get messaging tools and cannot run CLI commands.

### 3) Install ShellCorp CLI command for operator use

From repo root:

```bash
npm link
shellcorp --version
```

### 4) Run one-command heartbeat smoke test

```bash
./scripts/heartbeat-smoke.sh --team-id team-proj-shellcorp-v2
```

Expected output:

- One line per agent:
  - `RESULT|<agent-id>|pass|status_and_heartbeat_ok`
- Final line:
  - `heartbeat-smoke:ok count=<N>`
- Exit code `1` if any agent fails marker checks.

Override defaults when needed:

```bash
./scripts/heartbeat-smoke.sh \
  --team-id team-proj-shellcorp-v2 \
  --convex-url http://127.0.0.1:3211 \
  --agents "shellcorp-pm shellcorp-builder"
```

### 5) Confirm timeline event landed in ShellCorp

```bash
SHELLCORP_CONVEX_SITE_URL=http://127.0.0.1:3211 \
  npm run shell -- team bot timeline --team-id team-proj-shellcorp-v2 --json

```

Expected:

- Timeline includes one or more new `heartbeat_smoke` events from the smoke run.

Reference: [OpenClaw Multi-Agent Routing](https://docs.openclaw.ai/concepts/multi-agent)

## Concept Video

Original concept demo of what an AI office could look like:

[Watch on Loom](https://www.loom.com/share/2252d33ca4f14d5a8a4671c30746c756)

## Job To Be Done

When a small team runs many autonomous agents on one VPS, they need a single office control center that makes sessions, teams, memory, skills, and autonomy loops easy to inspect and steer without rebuilding the runtime.

## Product Direction

ShellCorp is UI-first:

- OpenClaw owns runtime, sessions, routing, and plugin lifecycle.
- ShellCorp maps OpenClaw state into a gamified office UI.
- Team and office operations are CLI-first in this phase.
- Extensions stay plugin-first (starting with Notion comments hooks).

## Current Product Value

- Office personalization and decoration controls for operators.
- Team topology, role demand, KPI/goal shaping, and heartbeat controls.
- Observability across team state, agent memory, and federated Kanban sync health.
- Team/agent timeline visibility backed by Convex event streams (`teamId` + `projectId` scope).
- Explicit operator governance for autonomy loops (pause/resume/manual run).

Feature docs:

- `docs/feature-decorations.md`
- `docs/feature-cli.md`
- `docs/feature-business-logic.md`
- `docs/extensions.md`

## Scope Boundaries

In scope now:

- UI + adapter mapping on top of OpenClaw.
- CLI-first team and office operations (`npm run shell -- ...`).
- Canonical-provider-per-project federation baseline (`internal`/`notion`/`vibe`).
- Notion comments-first webhook integration via OpenClaw hooks.

Out of scope now:

- Rebuilding a custom runtime/gateway that duplicates OpenClaw.
- Full multi-master board writes with implicit conflict resolution.
- Hiding canonical provider ownership semantics.

## Behavioral Invariants

- OpenClaw is source-of-truth for runtime and sessions (`MEM-0100`).
- Team/org metadata lives in sidecar JSON (`MEM-0104`).
- Navigation is panel-first and parity-critical flows remain dedicated modal-based (`MEM-0107`, `MEM-0109`).
- Ticket lifecycle maps to session lifecycle until explicit close/reopen (`MEM-0112`).
- Team and office management remain CLI-first in current phase (`MEM-0119`, `MEM-0120`).
- Team timeline/audit logs are first-class by `teamId` in Convex writes and queries (`MEM-0132`).

## Recent Changes

- Added AI office UI QA runbook (`MEM-0118`).
- Added CEO Team Management CLI and docs-only SCL cookbook (`MEM-0119`).
- Added Office Decoration CLI and meshy-based spec generation workflow (`MEM-0120`).

## Canonical Indexes

- OpenClaw Multi-Agent Routing: [https://docs.openclaw.ai/concepts/multi-agent#multi-agent-routing](https://docs.openclaw.ai/concepts/multi-agent#multi-agent-routing)
- OpenClaw Plugins: [https://docs.openclaw.ai/tools/plugin#plugins](https://docs.openclaw.ai/tools/plugin#plugins)

## Repo Surfaces

- `ui/src/**`: office UI, panels, and interaction flows.
- `cli/**`: ShellCorp CLI command entry and handlers.
- `skills/**`: repo-local skills for operators/agents.
- `docs/specs/**`: SC01-SC10 and study specs.
- `docs/how-to/**`: runbooks and focused operational recipes.
