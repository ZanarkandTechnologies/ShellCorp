# CLI

## Purpose

ShellCorp's command-line entrypoints for onboarding, thin team operations, board workflow, office management, and local install/link flows.

The CLI is broader than the intended MVP operating surface today. This document describes the current public entrypoints, calls out the parts that feel overbuilt, and sets the direction for simplification.

## Public API / entrypoints

- `npm run shell -- <command>`
- `shellcorp <command>` after `npm link`
- `npm run cli:reinstall`
- `bash scripts/reinstall-cli.sh`

## Minimal example

```bash
npm run cli:reinstall
shellcorp onboarding --yes
shellcorp team list --json
shellcorp team config show --team-id team-proj-alpha --json
shellcorp team board task list --team-id team-proj-alpha --json
```

## Current Command Families

- `onboarding`: first-run ShellCorp bootstrap on top of an already-onboarded OpenClaw install
- `ui`: launch the office UI
- `team`: team lifecycle, board/task flow, business config, monitoring, presets, resources, funds, heartbeat, and run helpers
- `agent`: agent config and runtime inspection
- `office`: office printing, layout objects, and decor/style control
- `doctor`: sidecar contract validation
- top-level `status`: shortcut for writing structured task/activity updates

## Audit

The CLI currently exposes a large surface area. The highest-density groups are:

- `office`: many decor/layout commands that are useful but not core to the founder-control loop
- `team board`: task lifecycle and activity commands that are core
- `team business`: business/team shaping commands with some MVP value and some drift
- review/planning work should happen directly on board tasks instead of through a separate proposal namespace

The product direction is thinner than the current command count suggests.

### What Feels Canonical

- `onboarding`
- `ui`
- `team list`
- `team show`
- `team create`
- `team update`
- `team archive`
- `team config show`
- `team config resources get|set`
- `team monitor`
- `team board task add|update|move|list`
- `team status report`
- `agent config show|set-skills|set-heartbeat`
- `agent monitor`
- `doctor team-data`

### What Feels Optional Or At Risk

- proposal-specific command surfaces instead of direct board-task planning/review flow
- large preset/business helper surfaces that create product-specific structure before it is proven necessary
- office decor/style command depth beyond basic demo/operator needs

## Canonical State Model

ShellCorp should stay thin and inspectable.

- The kanban board keeps the minimal structure needed for routing and execution:
  `taskId`, `projectId`, `teamId`, `status`, `priority`, ownership, timestamps, approval/session metadata.
- The actual working content for a task or project should default to markdown text.
- Project/task history should remain append-only and auditable.
- Agents should be able to replace or extend the current markdown body as the latest working state, while the event log preserves the trail.

In practice, this means:

- keep structured state for board mechanics and session linkage
- keep rich project/task content in markdown bodies, not sprawling JSON contracts
- keep append-only logs under the sidecar root as the durable execution history

## Simplification Direction

The CLI simplification target is:

1. Keep structure around the shared kanban board.
2. Prefer markdown files or markdown bodies for task/project working state.
3. Prefer append-only logs for history.
4. Avoid introducing proposal-specific stores when a board task plus markdown body can carry the workflow.
5. Treat `team config`, `agent config`, `team monitor`, and `team board` as the core operator loop.

This matches the current file-backed resource model and the append-only event stream already used by team monitoring.

## Recommended MVP Surface

If you are building against the current product direction, start with:

- `shellcorp onboarding`
- `shellcorp ui`
- `shellcorp team list`
- `shellcorp team create`
- `shellcorp team config show`
- `shellcorp team config resources get`
- `shellcorp team config resources set`
- `shellcorp team board task add`
- `shellcorp team board task update`
- `shellcorp team board task move`
- `shellcorp team board task memory set`
- `shellcorp team board task memory append`
- `shellcorp team board task claim`
- `shellcorp team board task mine`
- `shellcorp team board task list`
- `shellcorp team monitor`
- `shellcorp agent config show`
- `shellcorp agent config set-skills`
- `shellcorp agent config set-heartbeat`
- `shellcorp agent monitor`

## Example Workflow

```bash
shellcorp onboarding --yes
shellcorp ui
shellcorp team create --name "Affiliate Lab" --description "Small affiliate loop" --goal "Publish and learn"
shellcorp team config resources set --team-id team-proj-affiliate-lab --text $'# Resources\n\nbudget: small\nconstraints: stay text-first\n'
shellcorp team board task add --team-id team-proj-affiliate-lab --title "Draft execution brief" --detail $'Goal: turn the approved idea into a working markdown brief.\n\nNext:\n- define first KPI\n- define first content batch'
shellcorp team board task memory append --team-id team-proj-affiliate-lab --task-id task-1 --text $'## Plan\n- gather context\n- draft first KPI\n- move to review'
shellcorp team board task move --team-id team-proj-affiliate-lab --task-id task-1 --status review
shellcorp team monitor --team-id team-proj-affiliate-lab --json
```

## How To Think About Task State

- Use the board card metadata for status, owner, and routing.
- Use the task title plus markdown detail/body for the current working memory.
- Use the project event log for the append-only execution trail.
- Do not assume every new workflow needs a new structured object model.

## How to test

```bash
npm run test:once -- cli/cli-install.test.ts cli/onboarding-commands.test.ts cli/team-commands.test.ts
```
