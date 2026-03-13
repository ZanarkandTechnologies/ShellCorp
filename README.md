# Shell Company

Gamified control center UI for OpenClaw multi-agent operations.

ShellCorp keeps OpenClaw as the runtime source of truth and adds a UI-first office for setup, inspection, and operator control.

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
npm run shell -- onboarding
npm run shell -- ui
```

What `shellcorp onboarding` does:

- starts with a ShellCorp intro and an OpenClaw-first preflight check
- creates missing ShellCorp sidecar JSON under `~/.openclaw`
- creates or updates `~/.openclaw/openclaw.json` with the minimum ShellCorp wiring
- adds the in-repo Notion plugin load path and default `notion-shell` entry
- asks for a basic office style preset
- shows a staged bootstrap flow so you can see each setup phase complete
- generates `ui/.env.local` with safe `VITE_*` values
- copies Convex URL from the repo-root `.env.local` when available
- runs doctor checks and prints the next steps
- offers to launch the UI immediately so you can continue onboarding in-app

After that:

1. Open the UI.
2. Complete the in-app onboarding flow.
3. Use the UI to learn the office panels, CEO controls, and connector setup.

Notes:

- If you already ran `npx convex dev`, `shellcorp onboarding` will reuse the Convex URL from the repo-root `.env.local`.
- If you have a protected gateway, set `VITE_GATEWAY_TOKEN` when prompted or rerun `shellcorp onboarding --gateway-token <token>`.
- Start the UI with `npm run shell -- ui` from the repo root.
- If you prefer a global CLI, run `npm link` and then use `shellcorp onboarding` / `shellcorp ui`.
- Use `shellcorp onboarding --launch-ui` if you want the CLI to jump straight into the UI after bootstrap.

## Quick Start for Developers

From the repo root:

```bash
npm install
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
- `npm run shell -- onboarding --launch-ui`
- `npm run shell -- ui`
- `shellcorp ui`
- `npm run shell -- doctor team-data --json`
- `npm run shell -- office doctor --json`
- `npm run shell -- team list --json`

Developer notes:

- The CLI and UI both read ShellCorp sidecars from `~/.openclaw`.
- The UI reads `VITE_*` values from `ui/.env.local`; backend/private env stays in the repo-root `.env.local`.
- `templates/` is only for bootstrap and scaffolding. It is not the live source of truth after onboarding runs.

## More Docs

- [docs/prd.md](./docs/prd.md)
- [docs/progress.md](./docs/progress.md)
- [docs/public-docs/getting-started.md](./docs/public-docs/getting-started.md)
- [extensions/notion/README.md](./extensions/notion/README.md)
