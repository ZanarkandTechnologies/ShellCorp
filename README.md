# Shell Company

Minimal AI office for OpenClaw teams.

ShellCorp keeps OpenClaw as the runtime source of truth and adds a founder-facing office for one job first: ask the CEO to form a team, review the proposal, approve it, and then manage the resulting company from one place.

## Repo Map

The repo is split into a few main surfaces:

- `cli/`: the ShellCorp CLI, including onboarding, team management, office commands, and doctor checks
- `convex/`: the Convex backend contracts, HTTP endpoints, and event/status persistence
- `extensions/`: in-repo OpenClaw extensions, starting with the Notion plugin
- `skills/`: agent-facing skills and workflow/tooling packages used by the ShellCorp platform
- `ui/`: the Vite/React office UI and its local state bridge
- `templates/`: bootstrap files for OpenClaw config, sidecars, and workspace scaffolding

Canonical local state lives under `~/.openclaw`, especially:

- `~/.openclaw/openclaw.json`
- `~/.openclaw/company.json`
- `~/.openclaw/office-objects.json`

## What To Demo

The smallest convincing ShellCorp demo is not a huge pre-populated office. It is a tight loop:

1. Install the ShellCorp CLI.
2. Run onboarding.
3. Ask the CEO to form a team for an idea.
4. Review the proposal in the office.
5. Approve it.
6. Watch the new team appear and start working.

For staged demos, use progressive company shapes instead of a large permanent roster:

- `1-claw company`: one focused executor team
- `2-claw company`: executor plus operator/reviewer split
- `3-claw company`: executor plus operator plus growth/analysis split

All of those should be created through the CEO + team-formation workflow, not hardcoded as static office content.

## Quick Start for Users

Prerequisites:

- Node.js 20+
- OpenClaw installed locally or on the target machine
- OpenClaw onboarding completed first on that machine

Important:

- ShellCorp does not replace OpenClaw setup.
- If OpenClaw has not created `~/.openclaw/openclaw.json` and the main CEO agent `main`, the ShellCorp office will not show the main agent correctly.

From the repo root:

```bash
npm install
npm link
npm run shell -- onboarding
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
- runs doctor checks and prints the next steps
- offers to launch the UI immediately so you can continue onboarding in-app

After that:

1. Open the UI.
2. Complete the in-app onboarding flow.
3. Ask the CEO agent to create your first team proposal.
4. Approve the proposal in User Tasks / the CEO workbench flow.
5. Inspect the created team in the office and board surfaces.
6. Use `shellcorp office decor ...` only after the core founder workflow is working.

Notes:

- If you already ran `npx convex dev`, `shellcorp onboarding` will reuse the Convex URL from the repo-root `.env.local`.
- If you have a protected gateway, set `VITE_GATEWAY_TOKEN` when prompted or rerun `shellcorp onboarding --gateway-token <token>`.
- Start the UI with `npm run shell -- ui` from the repo root.
- `shellcorp onboarding` can run `npm link` for you, or you can run it manually first.
- In non-interactive flows such as `--yes`, pass `--install-cli` if you want onboarding to run `npm link`.

- Use `shellcorp onboarding --launch-ui` if you want the CLI to jump straight into the UI after bootstrap.

## Quick Start for Developers

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

Useful commands:

- `npm run shell -- onboarding --json`
- `npm run shell -- onboarding --install-cli`
- `npm run shell -- onboarding --skip-install-cli`
- `npm run shell -- onboarding --launch-ui`
- `npm run shell -- ui`
- `npm run shell -- office decor docs`
- `npm run shell -- office decor list`
- `npm run shell -- office decor pack list`
- `npm run shell -- office decor floor list`
- `npm run shell -- office decor wall list`
- `npm run shell -- office decor background list`
- `npm run shell -- office decor pack apply clam-cabinet`
- `npm run shell -- office decor background set midnight_tide`
- `shellcorp ui`
- `npm run shell -- doctor team-data --json`
- `npm run shell -- office doctor --json`
- `npm run shell -- team list --json`

Developer notes:

- The CLI and UI both read ShellCorp sidecars from `~/.openclaw`.
- The UI reads `VITE_*` values from `ui/.env.local`; backend/private env stays in the repo-root `.env.local`.
- The global `shellcorp` alias comes from the package `bin` entry plus `npm link`.

- `templates/` is only for bootstrap and scaffolding. It is not the live source of truth after onboarding runs.

## More Docs

- [docs/prd.md](./docs/prd.md)
- [docs/progress.md](./docs/progress.md)
- [docs/public-docs/getting-started.md](./docs/public-docs/getting-started.md)
- [extensions/notion/README.md](./extensions/notion/README.md)
