# Product Requirements Document: Fahrenheit

**Status**: Draft
**Created**: 2026-02-21
**Updated**: 2026-02-23
**Author**: gpt-5.3-codex

## Job To Be Done

When messages and tasks pile up across communication channels and work systems, a founder or small team needs autonomous AI workers that can listen continuously, gather context across real tools, execute work safely on a VPS, and show a full audit trail of what happened.

## Audience

- Solo founders operating across messaging, docs, and issue-tracking tools
- Small teams that want one autonomous operations layer across channels
- Teams that prefer VPS-hosted control over ad-hoc local automation

## Problem

Most agent stacks are either chat-only assistants or brittle automation scripts. They do not maintain durable per-conversation context, cannot reliably execute kanban-driven work loops, and rarely expose enough observability for trust.

## Solution

Build Fahrenheit as an autonomous company control layer across four pillars:

1. **Channel gateway**: normalize inbound events from Slack, Discord, Telegram, WhatsApp, and route to session-keyed agents.
2. **Ontology and skill layer**: map provider schemas into canonical entities, then generate callable tools/pipelines from text-defined system descriptions.
3. **Autonomous execution loop**: run kanban-driven execution where agents gather context, plan, delegate computer work, verify outcomes, and close/report tasks.
4. **Observational memory and observability**: collect ongoing signals via scheduler/heartbeat, synthesize durable memory, and log all decisions/actions with correlation IDs.

Core platform behaviors:

- One persistent agent runtime hosts many session-keyed agents (one per DM/group/session key)
- Each agent can spawn delegated subprocess work (`opencode`, `oagi`) without blocking inbound handling
- Ontology-first contract layer maps provider-specific models into canonical entities
- Text-defined integrations can produce reusable generated tools/pipelines
- Memory is pragmatic and file-backed (`HISTORY.md`, `MEMORY.md`) with trust and promotion rules
- Local cron + heartbeat drive proactive workflows (including ticket closing loops)
- Convex (SLC-2) provides log ingestion, control APIs, and visualization data

## Goals

- Reliable always-on message handling for Telegram, Discord, Slack, and WhatsApp
- One agent session per configured routing key (DM/group/session), preserving context over time
- Canonical ontology operations (`list/get/create/update/search`) over Task, Project, Goal, and CRM records
- Text-defined integration mapping that can be compiled into callable pipelines/tools
- Kanban executor loop that can autonomously progress and close work items
- Workflow and blocker detection from observed channel activity
- Strong operational audit trail and traceability across parent/subagent execution
- Human takeover path via direct VPS access and delegated process resume

## Non-Goals (SLC-1)

- Fully self-directed long-horizon swarm planning with no human guardrails
- Production-grade horizontal auto-scaling across many hosts
- Full BI suite or analytics warehouse replacement
- Massive connector catalog before ontology reliability and execution quality are proven

## Constraints

- TypeScript-first implementation
- Pi runtime as the core agent layer
- VPS-hosted execution plane with bash capability
- Security-first defaults (allowlists, secret resolution, redaction, policy checks)
- Spec-first workflow: approve specs before implementation
- Keep OpenClaw mental-model compatibility for routing/session/config where high-value, while deferring non-core bloat

## Success Metrics

- Gateway handles inbound and proactive outbound messaging with session-aware routing
- Session-keyed agents persist and restore context across restarts
- At least one kanban item closes end-to-end via autonomous execution loop
- Text-to-ontology and ontology-to-tool pipeline path works with confidence-gated writes
- Channel observer emits actionable workflow/blocker events with provenance
- Logs are durable and queryable locally (SLC-1), with Convex integration path defined
- Operators can inspect and intervene in delegated `opencode`/`oagi` workflows

## Risks

- Tool-generation sprawl if generated pipelines are not policy-gated
- Session contention when many active session-keyed agents share one filesystem/runtime
- Credential leaks if skill/tool config loading and logging redaction are weak
- Backlog growth can outpace executor scheduling and verification throughput
- Incorrect ontology mapping inference can cause bad writes without strict confidence/approval gates
- Premature connector expansion can outpace product value and reliability

## Release Slices

- **SLC-1**: Core gateway + session-keyed runtime + scheduler/heartbeat + one channel end-to-end
- **SLC-1.5 (current focus)**: Canonical ontology MVP (Notion-first) + text mapping inference + ontology RPC (`ontology.mapping.describe`, `ontology.query`, `ontology.text`) + write confidence gating
- **SLC-2**: Full channel set + Convex logging/API/dashboard + observer pipeline + kanban executor loop + ontology explainability and policy hardening
- **SLC-3**: Multi-provider ontology expansion (Linear/Jira/CRM/Attio) + richer autonomous workflow optimization + AI office visualization
