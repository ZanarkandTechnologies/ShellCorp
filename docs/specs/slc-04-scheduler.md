# Spec: Scheduler

**Status**: Draft
**Created**: 2026-02-21
**Author**: gpt-5.3-codex

## Problem

The system must run recurring checks and actions even when users are idle, without relying on external platform schedulers for local bash-dependent execution.

## Solution

Use local cron scheduling (`croner`) with a persistent JSON job store plus a dedicated heartbeat loop.

## Success Criteria

- [ ] SC-1: Jobs persist in `~/.fahrenheit/cron-jobs.json` and restore on startup
- [ ] SC-2: Scheduler executes interval and cron-expression jobs reliably
- [ ] SC-3: Heartbeat runs every configured interval and supports suppressed `HEARTBEAT_OK`

## Out of Scope

- Distributed lock scheduling across multiple hosts
- Managed cloud scheduler as execution source

## Technical Approach

- **Engine**: `croner` + in-memory runtime registry
- **Persistence**: JSON store with validation and migration version
- **Agent hook**: Job execution prompts target sessions

## Open Questions

1. How should missed runs be handled after downtime (skip vs catch-up)?
2. Should heartbeat and cron share one queue or separate queues?
