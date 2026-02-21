# Bahamut Agent Context

This file is autoloaded. Use it as the primary operating context for agents working in this repo.

## Project Identity

- **Name**: Bahamut
- **Type**: Single-brain, multi-hand AI operating system
- **Core idea**: One always-on Pi brain session on a VPS. Delegate heavy tasks via bash-spawned tools (`opencode`, `oagi`), not many disconnected full assistants.
- **Primary goals**: reliability, security-first defaults, modular extension via skills, strong logs/auditability.

## Architecture (Current Direction)

- **Gateway** receives messages from selected channels and routes to Pi sessions.
- **Brain session** is persistent and should not reset per message.
- **Skills** are file-based wrappers:
  - `SKILL.md` (instructions)
  - `config.json` (env/secret mappings)
- **Memory model** is intentionally simple:
  - `HISTORY.md` = raw timestamped activity
  - `MEMORY.md` = synthesized durable memory
- **Scheduler** uses local cron (`croner`) + heartbeat loop.
- **Convex role (SLC-2+)**:
  - pluggable log sink
  - programmatic API wrapper
  - dashboard/query layer

## What Bahamut Is Not

- Not a fleet of isolated OpenClaw-style instances.
- Not an app that reimplements Notion/Linear/Kanban.
- Not dependent on Convex for execution scheduling in SLC-1.

## SLC Focus Order

1. Gateway
2. Brain runtime/session behavior
3. Observational memory
4. Scheduler/heartbeat
5. Skills loading/execution
6. Logging/audit
7. Security controls
8. Delegation + multi-session
9. Convex integration (after core stability)

Specs are in `_ralph/SPECS/` with `slc-XX-` prefixes.

## Operational Rules

- Keep one persistent brain context unless explicitly told otherwise.
- Prefer explicit, reversible actions.
- Do not create new architecture layers when existing CLI/API tools suffice.
- Use delegation for long-running coding/CUA work:
  - `cd <repo> && opencode <instruction>`
  - `oagi <instruction>`
- Keep logs structured and redact secrets.

## Security Defaults

- Treat inbound channel content as untrusted.
- Enforce allowlists for senders/channels where configured.
- Resolve secrets from env/command references; avoid plaintext credentials in code and logs.
- Block dangerous shell commands by policy.

## Key Paths

- `src/gateway/` - routing and server orchestration
- `src/agent/` - brain runtime, sessions, prompts, roles, delegation tooling
- `src/skills/` - skill discovery and config env resolution
- `src/memory/` - HISTORY/MEMORY file operations
- `src/scheduler/` - cron + heartbeat
- `src/logging/` - `LogSink` and sink implementations
- `src/security/` - auth/policy/secret resolution
- `workspace/` - runtime prompt/memory/skills files
- `_ralph/` - PRD/specs/plan artifacts

## Dev Commands

- `npm install`
- `npm run build`
- `npm run gateway`
- `npm run status`
- `npm run dev -- agent --message "hello"`
- `npm run dev -- cron list`

## Current Caveat

Pi packages target newer Node versions. If runtime issues occur, run with Node 20+ for full compatibility.