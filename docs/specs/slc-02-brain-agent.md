# Spec: Brain Agent

**Status**: Draft
**Created**: 2026-02-21
**Author**: gpt-5.3-codex

## Problem

A stateless request/response agent cannot continuously operate, remember context, and handle concurrent inbound traffic while delegating long-running work.

## Solution

Run an always-on Pi session as the brain on the VPS with persistent transcript storage, inbound queue handling, and delegation through bash-launched processes.

## Success Criteria

- [ ] SC-1: Brain session persists and restores context across restart
- [ ] SC-2: Inbound while busy is queued/steered without losing user messages
- [ ] SC-3: Brain can launch `opencode` and `oagi` via bash with captured run metadata

## Out of Scope

- Autonomous long-horizon planning engine
- Cross-machine distributed scheduling

## Technical Approach

- **Agent**: `createAgentSession` + `SessionManager.open`
- **Tools**: Pi built-ins (`read`, `bash`, `edit`, `write`) + small custom tools
- **Prompt**: Compose from workspace docs and loaded skills index

## Open Questions

1. Should brain session key be global (`brain:main`) or per-agent profile?
2. How aggressive should interruption (`steer`) be vs queued follow-up?
