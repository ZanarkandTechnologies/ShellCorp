# Spec: Delegation and Multi-Session

**Status**: Draft
**Created**: 2026-02-21
**Author**: gpt-5.3-codex

## Problem

The always-on brain cannot block on long coding/CUA tasks while also continuing to process incoming message streams.

## Solution

Delegate heavy work via bash-launched processes while preserving one primary brain stream:

- Coding delegation: `cd <repo> && opencode <flags> <instruction>`
- CUA delegation: `oagi <instruction>`
- Multi-session roles: additional Pi sessions with different prompts/heartbeat goals

## Success Criteria

- [ ] SC-1: Brain can spawn delegated processes and continue processing messages
- [ ] SC-2: Delegated run metadata is logged with correlation IDs
- [ ] SC-3: Role sessions can be created/stopped with distinct configs

## Out of Scope

- Autonomous swarm planning protocol
- Strong consistency shared memory across all sessions

## Technical Approach

- **Spawner**: wrapper around bash execution with process metadata capture
- **Sessions**: role configs map to independent `SessionManager` files
- **Collaboration**: shared filesystem and explicit file handoff paths

## Open Questions

1. Should role sessions be always-on or heartbeat-on-demand by default?
2. How should manual resume links to delegated runs be surfaced in CLI status?
