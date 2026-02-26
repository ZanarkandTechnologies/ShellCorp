# Shell Company

Gamified control center UI for OpenClaw multi-agent operations.

## Concept Video

Original concept demo of what an AI office could look like:

[Watch on Loom](https://www.loom.com/share/2252d33ca4f14d5a8a4671c30746c756)

## Product Direction

This repository is now UI-first:

- OpenClaw handles runtime, routing, sessions, and plugin loading.
- Shell Company maps OpenClaw state into a gamified office UI.
- Notion logic is being packaged as an in-repo OpenClaw extension.
- Shell Company is expanding into a personalized autonomous company cockpit:
  - Multi-provider mission visibility (Notion/Vibe/internal)
  - Ticket/session lifecycle control
  - Context graphing and generated context tools/skills
  - Heartbeat/autonomy observability and intervention controls
  - Agent identity and office personalization (2D/2.5D/3D)

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
- `docs/specs/SC01..SC10` define state mapping, plugin packaging, memory/skills surfaces, chat bridge contracts, kanban federation, lifecycle controls, context indexing, personalization, and heartbeat autonomy.

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
- Expand observability for agent/session state, memory, and cross-agent context transfer.
- Route operator chat actions and lifecycle controls from UI back into OpenClaw sessions.
- Federate board workflows across Notion/Vibe/internal sources with explicit sync ownership.
- Ship context indexing that generates reusable context tools/skills for autonomous execution.
- Expose heartbeat/autonomy governance with pause/resume/manual-run and traceable state.
