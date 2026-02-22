# Product Requirements Document: Fahrenheit

**Status**: Draft
**Created**: 2026-02-21
**Author**: gpt-5.3-codex

## Job To Be Done

When messages and tasks pile up across communication channels and work systems, a founder or small team needs a persistent AI operator that can listen continuously, execute real work through existing CLI/API tools, and keep shared context over time.

## Audience

- Solo founder operating across multiple channels and repositories
- Small teams needing one shared AI "operations brain"
- Teams that prefer VPS-hosted control over local-first ad-hoc tooling

## Problem

Existing agent stacks are either over-bloated, hard to trust, or optimized for ad-hoc interactive coding instead of persistent operations. Running many disconnected agents creates fragmented memory, duplicated configuration, and high operational overhead.

## Solution

Build Fahrenheit as a single-brain, multi-hand operating system:

- One always-on Pi session on a VPS handles gateway message streams
- The brain delegates coding/CUA to bash-spawned tools (`opencode`, `oagi`)
- Skills are CLI wrappers with per-skill config and API credentials
- Memory is two-file and pragmatic (`HISTORY.md`, `MEMORY.md`)
- Local cron + heartbeat drive proactive operation
- Convex (SLC-2) provides logs, API wrapper, and dashboard visualization

## Goals

- Reliable always-on message handling for Telegram, Discord, Slack, WhatsApp
- No new session per inbound message; preserve context with queue/steer behavior
- Strong operational audit trail and traceability
- Extensible skills system without rebuilding third-party products
- Human takeover path via direct VPS access and resuming spawned processes

## Non-Goals (SLC-1)

- Full autonomous multi-agent collaboration engine
- Rich CUA orchestration platform
- Production-grade horizontal auto-scaling
- Full BI analytics suite

## Constraints

- TypeScript-first implementation
- Pi runtime as the core agent layer
- VPS-hosted primary process with bash capability
- Security-first defaults (allowlists, secret resolution, logging)
- Spec-first workflow: write and approve specs before implementation

## Success Metrics

- Gateway receives and responds to inbound channel messages with persistent sessions
- Heartbeat and cron execute reliably across restarts
- At least one real skill (e.g. GitHub via `gh`) runs end-to-end
- Logs are durable and queryable locally (SLC-1), with Convex integration path defined
- User can manually inspect/intervene in delegated `opencode`/`oagi` workflows

## Risks

- Tooling sprawl from too many CLI-dependent skills
- Session contention if role sessions share filesystem without guardrails
- Credential leaks if per-skill config loading is not strict
- Backlog growth can outpace naive delegation logic

## Release Slices

- **SLC-1**: Core gateway + brain + skills + local cron/heartbeat + one channel end-to-end
- **SLC-2**: Full channel set + Convex logging/API/dashboard + richer memory operations
- **SLC-3**: AI office visualization, role-session collaboration patterns, workflow optimization
