# Getting Started

This is the longer companion to the root `README.md`. The default setup path is now `shellcorp onboarding`, not manual template copying.

## Prerequisites

- Node.js 20+
- OpenClaw installed
- Access to the machine that will host `~/.openclaw`
- OpenClaw onboarding already completed on that machine

If OpenClaw has not yet created `~/.openclaw/openclaw.json` with the main CEO agent `main`, stop there first. ShellCorp onboarding now checks this before it writes ShellCorp-specific files.

## First Run

From the repo root:

```bash
npm install
npm run shell -- onboarding
npm run shell -- ui
```

Onboarding now handles:

- missing sidecar JSON bootstrap in `~/.openclaw`
- minimum OpenClaw config wiring for ShellCorp
- Notion plugin load-path and default entry setup
- office style preset capture
- staged progress output for each bootstrap phase
- generation of `ui/.env.local`
- Convex URL handoff from repo-root `.env.local` to `VITE_CONVEX_URL`
- doctor checks before sending you into the UI
- optional immediate UI launch at the end of the flow

## UI Environment

ShellCorp treats env files in two buckets:

- repo-root `.env.local`: backend and private values such as Convex/OpenRouter/Notion tokens
- `ui/.env.local`: UI-safe `VITE_*` values only

This split is intentional because the Vite app reads its env from `ui/`, not the repo root.

If you run `npx convex dev` and it writes a Convex URL into the repo-root `.env.local`, rerun:

```bash
npm run shell -- onboarding
```

That refreshes `ui/.env.local` so the UI can read `VITE_CONVEX_URL`.

## CLI Notes

Repo-local:

```bash
npm run shell -- onboarding --json
npm run shell -- onboarding --launch-ui
```

Global:

```bash
npm link
shellcorp onboarding
shellcorp ui
```

Useful follow-up checks:

```bash
npm run shell -- doctor team-data --json
npm run shell -- office doctor --json
```

## Next

- Complete the in-app onboarding flow after the UI boots.
- Read [feature-teams-heartbeats.md](./feature-teams-heartbeats.md) for the workspace + heartbeat model.
- Read [feature-personalization.md](./feature-personalization.md) for custom mesh and decor conventions.
- Read [docs/prd.md](../prd.md) for product direction.

- Read [extensions/notion/README.md](../../extensions/notion/README.md) if you need webhook/plugin details.
