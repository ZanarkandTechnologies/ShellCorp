# Feature: Teams, Workspaces, And Heartbeats

This page explains how ShellCorp turns one business goal into a running OpenClaw-backed team.

## Value

- Keep the team model simple: define a goal, create agents, give them a workspace, and let them execute.
- Make autonomous work explicit and auditable instead of hiding it behind vague background automation.
- Keep OpenClaw as the runtime source of truth while ShellCorp handles orchestration and operator visibility.

## The Mental Model

ShellCorp starts with one office.

When you create a team, ShellCorp does not invent a separate runtime. It provisions OpenClaw-backed agents, gives each one a workspace and runbook files, and then installs heartbeat jobs that wake those agents to keep working.

The short version is:

1. Define a project goal.
2. Create a team and its agents.
3. Provision OpenClaw runtime entries and per-agent workspaces.
4. Write role/runbook files such as `AGENTS.md` and `HEARTBEAT.md`.
5. Upsert cron heartbeat jobs.
6. Let the agents execute and inspect their work from ShellCorp.

## What Team Creation Provisions

When ShellCorp creates team agents, it also provisions the matching OpenClaw runtime surfaces:

- `~/.openclaw/openclaw.json`
  - adds or updates `agents.list` entries
- `~/.openclaw/workspace-<agentId>/`
  - creates bootstrap workspace files
- `~/.openclaw/agents/<agentId>/sessions/`
  - creates the session storage directories

This is why newly created team agents are immediately messageable and inspectable.

## Workspace Bootstrap Files

Each agent workspace is bootstrapped with files such as:

- `AGENTS.md`
- `SOUL.md`
- `TOOLS.md`
- `IDENTITY.md`
- `USER.md`
- `HEARTBEAT.md`

These files give the agent a local operating context. `HEARTBEAT.md` is the most important one for scheduled autonomous work.

## HEARTBEAT.md

`HEARTBEAT.md` is the runbook for an agent's autonomous loop.

In practice, ShellCorp uses it to tell the agent what kind of work to prioritize and how to behave on each wake-up. Business templates already exist for PM and executor roles, and those templates are copied into the agent workspace during setup.

That is the current mechanism behind "just let them rip": they are not free-running without guidance, they are repeatedly woken up and told to follow their local heartbeat runbook.

## Heartbeat Scheduling

ShellCorp writes cron jobs into:

- `~/.openclaw/cron/jobs.json`

Those jobs target the created agents and send a payload equivalent to:

- read `HEARTBEAT.md`
- follow it exactly
- return `HEARTBEAT_OK`

Current business heartbeat jobs use isolated sessions and a fixed cadence, with PM and executor loops created separately when applicable.

## Team Roles

The repo currently supports several team shapes, but the business-oriented model is intentionally simple:

- PM-style agents coordinate, reprioritize, and manage KPI pressure
- executor-style agents ship the work

That separation gives ShellCorp a usable founder/control loop without requiring a huge org chart.

For the MVP operator workflow, the main CLI surfaces should stay even simpler:

- `team config`
- `agent config`
- `team run`
- `team monitor`

The recommended live loop is:

1. `team create` or `team preset dev --apply`
2. `agent config` to tune role skills or per-agent heartbeat details
3. `team run live --cadence-minutes 1` to retune the actual OpenClaw heartbeat cadence
4. `team monitor` and `agent monitor` to inspect runtime state
5. review the Team Timeline or `team monitor` output for the canonical event stream

This keeps heartbeat-driven work inspectable and easy to test without forcing every team through a large preset or a hidden orchestration layer.

## Where ShellCorp Stops And OpenClaw Starts

OpenClaw owns:

- agent runtime
- sessions
- routing
- plugins
- tool policy and sandbox policy

ShellCorp owns:

- team formation
- founder/operator workflow
- workspace scaffolding
- heartbeat job generation
- office and CLI visibility over the resulting system

## What "Let Them Rip" Actually Means Here

At a high level, yes:

- create a goal
- create a team
- create the agents
- scaffold their workspaces
- install the heartbeat jobs
- let them work

But the important detail is that ShellCorp makes this explicit and inspectable. The agents are not running as an undocumented swarm. They have named workspaces, role files, heartbeat runbooks, session history, and a visible operator surface.

That operator surface now centers on the Convex-backed team timeline surfaced through Team Timeline and `team monitor`.

Task lifecycle updates, explicit status reports, activity logs, and heartbeat cadence changes should flow into that one realtime stream so the UI and CLI render the same operational view.

## Related Docs

- [feature-cli.md](./feature-cli.md)
- [feature-mvp-team-config.md](./feature-mvp-team-config.md)
- [feature-business-logic.md](./feature-business-logic.md)
- [architecture.md](./architecture.md)
- [SC10-spec-heartbeat-autonomy-loop.md](../specs/SC10-spec-heartbeat-autonomy-loop.md)
