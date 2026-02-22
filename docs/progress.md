# Fahrenheit SLC-1 Ticket Plan

**Status**: Draft
**Scope**: SLC-1 only
**Date**: 2026-02-21

## Ticket Board

| ID | Title | Depends On | Status |
|---|---|---|---|
| BAH-001 | Scaffold TypeScript project and workspace templates | - | pending |
| BAH-002 | Implement config schema/loader with secret resolution | BAH-001 | pending |
| BAH-003 | Implement logging foundation (LogSink + file/console sinks) | BAH-001 | pending |
| BAH-004 | Implement security foundation (auth + policy hooks) | BAH-002, BAH-003 | pending |
| BAH-005 | Implement gateway event bus and core router contracts | BAH-001 | pending |
| BAH-006 | Implement memory store/search (HISTORY.md + MEMORY.md) | BAH-001 | pending |
| BAH-007 | Implement skill manager and env injection | BAH-002, BAH-006 | pending |
| BAH-008 | Implement brain runtime/session management and prompt builder | BAH-002, BAH-004, BAH-005, BAH-006, BAH-007 | pending |
| BAH-009 | Implement scheduler (cron jobs + heartbeat) | BAH-002, BAH-005, BAH-008 | pending |
| BAH-010 | Implement Telegram channel adapter end-to-end | BAH-002, BAH-005, BAH-008 | pending |
| BAH-011 | Implement CLI commands (`gateway`, `agent`, `cron`, `status`) | BAH-002, BAH-005, BAH-008, BAH-009, BAH-010 | pending |
| BAH-012 | Implement basic role-session and delegation launcher (`opencode`, `oagi`) | BAH-008, BAH-011 | pending |
| BAH-013 | Implement Discord adapter (stretch) | BAH-010 | pending |

## Acceptance Criteria by Ticket

### BAH-001
- Project builds with `tsc --noEmit`
- Base directories and workspace template files exist

### BAH-002
- Config loads from path and validates with Zod
- `$ENV_VAR` and `!command` secret references resolve

### BAH-003
- `FileLogSink` writes JSONL to audit directory
- `ConsoleLogSink` prints structured logs

### BAH-004
- Unauthorized sender checks are enforceable
- Tool policy hooks are available for session role checks

### BAH-005
- Router accepts normalized inbound envelope
- Bus events emitted for inbound, outbound, cron, heartbeat

### BAH-006
- History append and memory write functions work
- Search returns matching snippets

### BAH-007
- Skills discovered from `workspace/skills/*`
- Skill env injected for bash command execution

### BAH-008
- Brain session persists and reloads
- Prompt assembly includes memory and skills index

### BAH-009
- Cron jobs persist/reload from JSON store
- Heartbeat runs at configured interval

### BAH-010
- Telegram inbound/outbound messages flow through router + brain

### BAH-011
- CLI can start gateway, send one-shot prompt, inspect status, manage cron

### BAH-012
- Delegation launcher can invoke configured `opencode`/`oagi` commands
- Run metadata is logged and queryable via status

### BAH-013 (stretch)
- Discord inbound/outbound path mirrors Telegram architecture
