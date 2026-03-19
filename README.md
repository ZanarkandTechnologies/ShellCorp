# ShellCorp

One AI office for running an OpenClaw-powered business.

ShellCorp is the founder-facing orchestration layer for OpenClaw. Start with one office, define a goal, ask the CEO to form a team, approve the plan, and run the work from a control surface that is operational, customizable, and actually fun to use.

OpenClaw stays the system of record for agents, sessions, routing, and plugins. ShellCorp adds the office, the CLI, the review loop, and the operator surfaces that turn raw agent runtime into something you can steer like a business.

## What Is ShellCorp?

If OpenClaw is the runtime, ShellCorp is the office.

ShellCorp is a UI-first control layer for founders and operators who want to run a small autonomous business from one place. Instead of juggling raw terminals, scattered configs, and hand-wired team coordination, you start with one office, ask the CEO to form a team around a goal, review the proposal, approve it, and monitor the work from the office or the CLI.

The product is intentionally different from a static "spawn a giant company" model:

- start with one office, not a crowded org chart
- create teams around a concrete goal when they are needed
- keep OpenClaw as the runtime source of truth
- make orchestration operational, but also playful and expressive

## How It Works

1. Define the business or goal you want to pursue.
2. Ask the CEO agent to form a focused team around that goal.
3. Review the proposal in ShellCorp and approve the work.
4. Manage the resulting team from the office, the board surfaces, and the CLI.

Inside a team:

- `Overview` shows compact roster cards with embedded face/avatar renders, role, live status, latest task context, and quick actions.
- `Memory` is the shared append-only team log for decisions, handoffs, and results, while Timeline and Kanban continue to show live execution state.
- direct agent-to-agent coordination is allowed through the CLI when session-local context matters, but it stays thin: the message runs through native OpenClaw transport and only leaves one visible breadcrumb in the shared timeline instead of reviving team chat as a second source of truth.

The main MVP loop is founder control, not artificial office scale.

## Why ShellCorp Is Different

- `OpenClaw-native`: ShellCorp sits on top of OpenClaw instead of rebuilding its runtime, session, routing, or plugin systems.
- `One office first`: the core unit is one AI office that can spawn teams for a mission, not a pre-populated multi-company dashboard.
- `Founder workflow`: CEO-led team formation, founder review, and approval are the primary product path.
- `Fun to operate`: the office is meant to feel alive, customizable, and rewarding to use, not just administratively correct.
- `Skills-aware`: ShellCorp includes tooling to inspect, understand, and use skills more effectively across agents.
- `Roster-led team ops`: each team surface makes it obvious who each agent is, what they are doing, and how to reach them.

## ShellCorp Is Right For You If

- you already use OpenClaw and want a founder-facing orchestration layer on top
- you want to define a business goal and let agents organize into focused teams around it
- you need one place to monitor sessions, proposals, board state, memory, and skills
- you want CLI control and office UI together instead of choosing one or the other
- you want the system to feel playful and customizable while still being operationally useful

## Features

- `CEO-led team formation`: create teams through a proposal and approval loop instead of hardcoding a company upfront
- `Office UI`: run ShellCorp from a visual office with focused operator surfaces instead of a pile of raw terminals
- `ShellCorp CLI`: onboard, manage teams, inspect office state, run doctor checks, and handle office decor from the command line
- `Session-scoped CLI identity`: agents can soft-login per shell session so status, coordination, and board writes resolve caller identity consistently without repeating `--agent-id`
- `Skills workbench`: inspect skills, demos, file-backed metadata, and per-agent skill configuration from one place
- `Memory and session visibility`: inspect agent memory, session context, and current work state from OpenClaw-backed data
- `Team presence and memory`: team overview surfaces show each member as a compact face/avatar card with role, live state, latest task, and quick actions, while the Memory tab keeps shared coordination/history in one append-only log instead of faux team chat
- `Plugin-first integrations`: keep integrations aligned with OpenClaw's plugin model, starting with the in-repo Notion plugin
- `Mesh and personalization path`: support agent personalization and mesh/image wrapper flows so the office can feel more alive over time
- `Office decor and style`: customize the office once the core founder-control loop is in place
- `Federated operations`: unify team and board context across ShellCorp and external providers without replacing the source systems

## Problems ShellCorp Solves

| Without ShellCorp | With ShellCorp |
| --- | --- |
| You have OpenClaw agents, configs, sidecars, and terminals, but no clear founder control surface. | You get one office and one workflow for forming teams, reviewing proposals, and overseeing active work. |
| You can run agents, but the jump from "one agent" to "a business with teams" is mostly manual. | The CEO can propose a team around a goal and ShellCorp gives you a reviewable path to approve and manage it. |
| You lose the story of what the office is doing because runtime details live in too many places. | ShellCorp brings memory, skills, sessions, boards, and team context into one operator-facing layer. |
| Your tooling feels purely operational and hard to enjoy using. | ShellCorp treats the office as both a control surface and a place you can personalize, decorate, and grow. |
| You want to use skills and integrations more intentionally, but discovery and operator visibility are weak. | ShellCorp adds skill-aware UI and CLI workflows so agents and operators can use the repo's skill system more effectively. |

## Quickstart

Prerequisites:

- Node.js 20+
- OpenClaw installed locally or on the target machine
- OpenClaw onboarding completed first on that machine

Important:

- ShellCorp does not replace OpenClaw setup.
- If OpenClaw has not created `~/.openclaw/openclaw.json` and the main CEO agent `main`, the ShellCorp office will not show the main agent correctly.

**OpenClaw onboarding (do this first):**

1. Install and run the OpenClaw onboarding wizard (recommended on macOS/Linux or Windows via WSL2):
   ```bash
   openclaw onboard
   ```
2. Use **QuickStart** for the fastest path (default workspace, gateway on port 18789, coding tool profile). The wizard creates `~/.openclaw/openclaw.json`, seeds the workspace, and configures model/auth.
3. OpenClaw’s default single-agent setup uses agent id **`main`**, which is what ShellCorp expects. If you added agents manually and don’t have `main`, either add it (`openclaw agents add main` and use the default workspace) or ensure `~/.openclaw/openclaw.json` has `agents.list` with an entry whose `id` is `"main"`.
4. Then run ShellCorp onboarding (see below).

Docs: [Onboarding Wizard (CLI)](https://docs.openclaw.ai/start/wizard), [CLI Onboarding Reference](https://docs.openclaw.ai/start/wizard-cli-reference).

From the repo root:

```bash
npm install
npm link
npm run shell -- onboarding
eval "$(shellcorp agent login --agent-id main)"
npm run shell -- whoami
npm run shell -- ui
```

What `shellcorp onboarding` does:

- starts with a ShellCorp intro and an OpenClaw-first preflight check
- creates missing ShellCorp sidecar JSON under `~/.openclaw`
- creates or updates `~/.openclaw/openclaw.json` with the minimum ShellCorp wiring
- adds the in-repo Notion plugin load path and default `notion-shell` entry
- offers to install the global `shellcorp` CLI alias with `npm link`
- asks for a basic office style preset
- shows a staged bootstrap flow so you can see each setup phase complete
- generates `ui/.env.local` with safe `VITE_*` values
- copies Convex URL from the repo-root `.env.local` when available
- persists the Convex site URL into ShellCorp runtime config so the CLI can reuse it without manual exports
- verifies whether the configured Convex runtime is actually reachable before it recommends or auto-launches the UI
- runs doctor checks and prints the next steps
- offers to launch the UI immediately only when the required runtime is ready, so onboarding does not hand off to a broken app

After that:

1. Open the UI.
2. Complete the in-app onboarding flow.
3. Ask the CEO agent to create your first team proposal.
4. Approve the proposal in `Human Review` inside the CEO Workbench.
5. Inspect the created team in the office and board surfaces.
6. Use `shellcorp office decor ...` after the core founder workflow is working.

## Minimal Demo Flow

Use this when you want to show the product story clearly instead of loading a crowded office:

```bash
npm install
npm link
npm run shell -- onboarding --launch-ui
scripts/reset-demo-office.sh --profile ladder
```

Then in the product:

1. Start with only the CEO and founder control loop visible.
2. Ask the CEO to form a `1-claw` team from a small brief.
3. Review and approve the proposal.
4. Show the created team board and activity.
5. Repeat with a `2-claw` or `3-claw` team to show that ShellCorp scales by spawning focused teams, not by shipping a giant default company.

## FAQ

### How is ShellCorp different from OpenClaw?

OpenClaw runs the agents. ShellCorp runs the office around them.

OpenClaw remains the runtime and source of truth for sessions, routing, plugins, and state. ShellCorp sits on top of that foundation and adds the founder workflow: CEO-led team formation, proposal review, operator visibility, office management, and CLI control.

### Is ShellCorp only for a research lab?

No. A research-lab workflow fits, but it is not the product boundary. ShellCorp is better described as an orchestration layer for running a business through one AI office, then spawning teams around concrete goals as the business grows.

### What does the CLI do?

The ShellCorp CLI handles onboarding, UI launch, team and proposal management, doctor checks, office commands, and decor workflows. It is part of the core product surface, not just a developer utility bolted onto the repo.

### What is the office personalization story?

ShellCorp includes office decor, style presets, and a broader personalization path for meshes and agent presence. The goal is not decoration for its own sake. The goal is to make the office feel alive and enjoyable without compromising the core founder-control workflow.

### How do skills fit into ShellCorp?

Skills are part of how ShellCorp makes agents easier to understand and operate. The repo includes a skill catalog, tests, demos, and UI/CLI surfaces that help operators see what skills exist, how they are meant to be used, and how they fit into multi-agent workflows.

## Repo Map

- `cli/`: the ShellCorp CLI, including onboarding, team management, office commands, and doctor checks
- `convex/`: backend contracts, HTTP endpoints, and event/status persistence
- `extensions/`: in-repo OpenClaw extensions, starting with the Notion plugin
- `skills/`: agent-facing skills and workflow/tooling packages used by the ShellCorp platform
- `ui/`: the Vite/React office UI and its local state bridge
- `templates/`: bootstrap files for OpenClaw config, sidecars, and workspace scaffolding

Canonical local state lives under `~/.openclaw`, especially:

- `~/.openclaw/openclaw.json`
- `~/.openclaw/company.json`
- `~/.openclaw/office-objects.json`

## Development

From the repo root:

```bash
npm install
npm link
npm run shell -- onboarding --yes
npm run shell -- ui
```

Validation:

```bash
npm run test:once
npm run typecheck
npm run build
```

Refresh the global CLI alias after pulling repo updates:

```bash
npm run cli:reinstall
```

Useful commands:

- `npm run shell -- onboarding --json`
- `npm run shell -- onboarding --install-cli`
- `npm run shell -- onboarding --skip-install-cli`
- `npm run shell -- onboarding --launch-ui`
- `eval "$(shellcorp agent login --agent-id alpha-pm)"`
- `npm run shell -- whoami --json`
- `npm run shell -- agent list --json`
- `npm run shell -- agent search --query builder --json`
- `npm run shell -- agent send --from alpha-pm --to alpha-builder --message "Need blocker update" --task-id task-42 --json`
- `npm run shell -- ui`
- `npm run shell -- team run live --team-id team-proj-shellcorp-dev-team --cadence-minutes 1 --goal "Live demo loop" --json`
- `npm run shell -- team monitor --team-id team-proj-shellcorp-dev-team --json`
- `npm run shell -- team archive --team-id team-proj-example --deregister-openclaw`
- `npm run shell -- office decor docs`
- `npm run shell -- office decor list`
- `npm run shell -- office decor pack list`
- `npm run shell -- office decor floor list`

For autonomous-team MVP work, the main runtime artifacts are:

- `~/.openclaw/openclaw.json`
- `~/.openclaw/projects/<projectId>/logs/`
- `~/.openclaw/projects/<projectId>/outputs/`
- `~/.openclaw/workspace-<agentId>/HEARTBEAT.md`

Realtime shared operational memory now lives in Convex-backed team/task surfaces, while OpenClaw workspace memory remains agent-owned/private and heavier artefacts stay filesystem-backed.
- agent-attributed CLI writes should come from a shell session that has been initialized with `shellcorp agent login`; `SHELLCORP_AGENT_ID` is the canonical caller identity and team/project scope are derived from the company model, with conflicting manual overrides failing fast.
- `npm run shell -- office decor wall list`
- `npm run shell -- office decor background list`
- `npm run shell -- office decor pack apply clam-cabinet`
- `npm run shell -- office decor background set midnight_tide`
- `npm run cli:reinstall`
- `shellcorp ui`
- `npm run shell -- doctor team-data --json`
- `npm run shell -- office doctor --json`
- `npm run shell -- team list --json`

When you archive a team with `--deregister-openclaw`, ShellCorp now removes that team's OpenClaw `agents.list` entries and deletes each managed agent workspace under `~/.openclaw` so retired businesses do not leave stale runtime folders behind.
- `npm run shell -- team proposal list --json`
- `npm run shell -- team proposal show --proposal-id <proposalId> --json`
- `scripts/reset-demo-office.sh --profile minimal`
- `scripts/reset-demo-office.sh --profile ladder`

Notes:

- `npm run typecheck` is the workspace-wide TypeScript gate and includes the UI package.
- `npm run typecheck:root` checks only the repo-root/CLI/Convex TypeScript program.
- `npm run build` currently preserves the narrower root-owned build gate; use `npm run ui:build` for the Vite bundle.
- The CLI and UI both read ShellCorp sidecars from `~/.openclaw`.
- The UI reads `VITE_*` values from `ui/.env.local`; backend/private env stays in the repo-root `.env.local`.
- Optional: set `VITE_MESHY_API_KEY` (get one at meshy.ai) to enable **Generate with AI** in Decoration → Import; generated GLB furniture is saved to Custom Library.
- The global `shellcorp` alias comes from the package `bin` entry plus `npm link`.
- `templates/` is only for bootstrap and scaffolding. It is not the live source of truth after onboarding runs.

## More Docs

- [docs/prd.md](./docs/prd.md)
- [docs/progress.md](./docs/progress.md)
- [docs/public-docs/getting-started.md](./docs/public-docs/getting-started.md)
- [docs/public-docs/feature-teams-heartbeats.md](./docs/public-docs/feature-teams-heartbeats.md)
- [docs/public-docs/feature-personalization.md](./docs/public-docs/feature-personalization.md)
- [extensions/notion/README.md](./extensions/notion/README.md)
