# Spec: Session-Keyed Agent Runtime

**Status**: Draft
**Created**: 2026-02-21
**Author**: gpt-5.3-codex

## Problem

A single global brain session creates contention across channels and does not match real operating patterns where each DM/group needs its own durable context and execution history.

## Solution

Run a persistent multi-session Pi runtime on the VPS where one independent agent session exists per routing key (DM/group/session key), with queueing, restoration, and delegation handled per session.

## Success Criteria

- [ ] SC-1: Session instances persist and restore context across restart by session key.
- [ ] SC-2: Inbound messages route to the correct session key and queue/steer safely when that session is busy.
- [ ] SC-3: Sessions can launch `opencode` and `oagi` via bash with captured run metadata and correlation IDs.
- [ ] SC-4: Runtime can enforce per-session policy profiles (tools, write gates, trust level).
- [ ] SC-5: Operators can inspect session health and manually take over any active session.

## Out of Scope

- Autonomous long-horizon planning engine
- Cross-machine distributed scheduling
- Strong consistency state sharing across all sessions

## Technical Approach

- **Session model**: `createAgentSession` + `SessionManager.open` keyed by gateway routing identity.
- **Routing contract**: gateway supplies normalized `sessionKey`, `sourceId`, and provenance metadata.
- **Concurrency**: isolate queue/steer behavior per session; no global lock for all inbound traffic.
- **Delegation**: sessions may spawn subprocess work and keep serving subsequent messages.
- **Policy**: role/session policy matrix resolves tool access, write permissions, and escalation requirements.
- **Prompting**: compose prompt from workspace docs, memory, and skill/tool registry with session-local context.

## Open Questions

1. What session idle timeout, if any, should archive inactive sessions?
2. How aggressive should interruption (`steer`) be vs queued follow-up for active sessions?
3. Which session metadata must be surfaced in `status` for safe operator takeover?
