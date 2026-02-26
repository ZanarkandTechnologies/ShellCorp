# Shell Company

Gamified control center UI for OpenClaw multi-agent operations.

## Product Direction

This repository is now UI-first:

- OpenClaw handles runtime, routing, sessions, and plugin loading.
- Shell Company maps OpenClaw state into a gamified office UI.
- Notion logic is being packaged as an in-repo OpenClaw extension.

Canonical indexes:

- OpenClaw Multi-Agent Routing: https://docs.openclaw.ai/concepts/multi-agent#multi-agent-routing
- OpenClaw Plugins: https://docs.openclaw.ai/tools/plugin#plugins

## Requirements

- Node.js 20+
- An OpenClaw instance running on your VPS or local environment

## Quick Start (UI)

```bash
npm install
npm run ui
```

By default, the UI expects an OpenClaw-compatible gateway endpoint at:

- `http://127.0.0.1:8787` (override via `VITE_GATEWAY_URL`)

### Quick Start Templates (OpenClaw + Sidecar)

For teams onboarding agents/operators, copy these template files and adjust ids/paths:

- `templates/openclaw/openclaw.template.json` -> `~/.openclaw/openclaw.json`
- `templates/openclaw/agents.list.template.json` -> `openclaw.json.agents.list` (reference snippet)
- `templates/sidecar/company.template.json` -> `~/.openclaw/company.json` or `workspace/office/company.json`
- `templates/sidecar/office-objects.template.json` -> `officeObjects.json` (or merge into `company.json.officeObjects`)

Example bootstrap:

```bash
mkdir -p ~/.openclaw
cp templates/openclaw/openclaw.template.json ~/.openclaw/openclaw.json
cp templates/sidecar/company.template.json ~/.openclaw/company.json
cp templates/sidecar/office-objects.template.json ./officeObjects.json
```

`openclaw.json` must include `agents.list` entries with stable `id`, `workspace`, sandbox mode, and tool policy so the UI can reconcile configured vs runtime agents.

## Architecture Summary

- `ui/src/**` contains the gamified office and operational panels.
- `src/**` contains remaining Notion-related logic being migrated to plugin form.
- `docs/specs/SC01..SC04` define state mapping, plugin packaging, memory/skills surfaces, and chat bridge contracts.

## OpenClaw State Model (MVP)

Shell Company adapters treat OpenClaw as source of truth:

- `~/.openclaw/openclaw.json`
- `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- `~/.openclaw/agents/<agentId>/sessions/*.jsonl`
- OpenClaw gateway APIs for online operations (send/refresh/session state)

## In-Repo Notion Extension Workflow

The Notion plugin is developed in-repo under an extension folder and loaded by OpenClaw via `plugins.load.paths`.

Typical local flow:

1. Implement/update plugin code and `openclaw.plugin.json`.
2. Point OpenClaw config `plugins.load.paths` to the extension directory.
3. Restart OpenClaw gateway.
4. Verify plugin is loaded:
   - `openclaw plugins list`
   - `openclaw plugins info <plugin-id>`

## Current Focus

- Keep and improve office/game visualization.
- Replace old data access paths with OpenClaw adapters.
- Upgrade memory and skills UI surfaces.
- Route operator chat actions from UI back into OpenClaw sessions.
