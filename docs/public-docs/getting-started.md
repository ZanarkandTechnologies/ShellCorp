# Getting Started

This guide is the fastest path to run ShellCorp UI, use the ShellCorp CLI, and install repo skills.

## Read Order

1. This file (`docs/getting-started.md`)
2. `docs/features-overview.md`
3. Feature deep dives linked from `docs/features-overview.md`

## Prerequisites

- Node.js 20+
- OpenClaw instance (local or VPS)
- Access to OpenClaw runtime state (`~/.openclaw/*`)

## Install Dependencies

From repository root:

```bash
npm install
```

## Start The UI

```bash
npm run ui
```

Default gateway URL:

- `http://127.0.0.1:8787`

Override with:

- `VITE_GATEWAY_URL=<your-gateway-url>`

## Configure Sidecar Templates

Use templates for initial local topology state:

```bash
mkdir -p ~/.openclaw
cp templates/openclaw/openclaw.template.json ~/.openclaw/openclaw.json
cp templates/sidecar/company.template.json ~/.openclaw/company.json
cp templates/sidecar/office-objects.template.json ./officeObjects.json
```

`openclaw.json` should include `agents.list` entries with stable `id`, `workspace`, sandbox mode, and tool policy.

## Install Repo Skills (Vercel Skills CLI)

ShellCorp keeps reusable skills in `skills/`.

Install from local directory:

```bash
npx skills add ./skills
```

One-command bootstrap (deps + skills):

```bash
npm install && npx skills add ./skills
```

Optional targeting (example):

```bash
npx skills add ./skills --skill shellcorp_team_cli --agent codex --yes
```

Current repo skill paths:

- `skills/shellcorp-team-cli/SKILL.md`
- `skills/office-decorator/skill.md`
- `skills/meshy/skill.md`

Skill-to-feature mapping:

| Skill | Primary workflow | Feature doc |
| --- | --- | --- |
| `shellcorp-team-cli` | team create/update/heartbeat/role-slot/archive workflows | `docs/feature-cli.md` |
| `office-decorator` | office print/list/add/move/remove/theme/generate workflows | `docs/feature-decorations.md` |
| `meshy-office-3d` | 3D asset generation for office decor and character ideation | `docs/feature-decorations.md` |

## ShellCorp CLI (Result Workflow CLI)

ShellCorp CLI is provided by the repo script and becomes available after `npm install`:

```bash
npm run shell -- team list
```

Core command families:

- `team` (create/list/update/archive, role-slot, heartbeat)
- `office` (print/list/add/move/remove/theme/generate)
- `doctor` (team-data validation)

Useful first checks:

```bash
npm run shell -- team list --json
npm run shell -- office print
npm run shell -- doctor team-data --json
```

## Next

- Capability map: `docs/features-overview.md`
- Intent-to-command cookbook: `docs/how-to/ceo-team-cli-scl-cookbook.md`
- Extensions and Notion hooks: `docs/extensions.md`
