# Product Requirements Document: Shell Company

**Status**: Draft  
**Created**: 2026-02-21  
**Updated**: 2026-02-25  
**Author**: gpt-5.3-codex

## Documentation Indexes

- OpenClaw Multi-Agent Routing: https://docs.openclaw.ai/concepts/multi-agent#multi-agent-routing
- OpenClaw Plugins: https://docs.openclaw.ai/tools/plugin#plugins

## Job To Be Done

When a small team runs many autonomous agents on one VPS, they need a single gamified control center that makes sessions, agents, memory, and skills easy to inspect and steer without rebuilding the underlying agent runtime.

## Audience

- Founders and small teams already running OpenClaw on a VPS
- Operators who need visual control over many agents/sessions
- Teams that prefer local state directories over additional hosted infrastructure

## Problem

OpenClaw already solves agent runtime, routing, and plugin loading. The missing layer is a high-quality office UI that maps the existing OpenClaw state into understandable operational views for day-to-day multi-agent management.

## Solution

Build Shell Company as a UI-first control center on top of OpenClaw:

1. **State mapping layer**: map OpenClaw state directories and gateway APIs into UI view models.
2. **Gamified office UX**: keep and expand existing visualization and game logic.
3. **Plugin-first integrations**: package Notion logic as an OpenClaw plugin instead of internal gateway code.
4. **Operational surfaces**: improve memory and skill visibility for agent orchestration.

## Core Platform Behaviors

- OpenClaw remains the system-of-record for agents, sessions, and routing
- UI reads from `~/.openclaw/agents/*`-derived state (through adapters) plus OpenClaw gateway APIs
- Agent and session topology follows OpenClaw multi-agent bindings
- Notion integration is shipped as an in-repo OpenClaw plugin
- Chat actions from UI are bridged back to OpenClaw gateway APIs

## MVP Focus

Single VPS, one shared OpenClaw instance, many agents:

- Show agent roster from OpenClaw state
- Show per-agent sessions and session activity timeline
- Support basic chat send/steer actions to OpenClaw
- Ship Notion plugin in-repo and wired for MVP workflows
- Ship upgraded Memory and Skills panels in the office UI

## Goals

- Preserve and enhance the gamified office UI as the primary product value
- Provide reliable session and agent observability from real OpenClaw state
- Package Notion integration as an OpenClaw extension with schema-driven config
- Keep architecture simple: local VPS state first, no mandatory external DB
- Make per-agent sandbox and tool policy visible in UI

## Non-Goals

- Rebuilding custom gateway/routing/config runtime that duplicates OpenClaw
- Building a generic public multi-tenant SaaS in this MVP
- Large connector marketplace beyond Notion in first slice
- Replacing OpenClaw core session/routing internals

## Constraints

- TypeScript-first implementation
- OpenClaw-compatible architecture and terminology
- In-repo plugin development model for fast iteration
- Spec-first workflow for major scope changes
- Security-first defaults for plugin trust and secret handling

## Success Metrics

- Operators can view active agents and sessions from OpenClaw-backed data
- Session timeline and chat bridge work for at least one real project flow
- Notion plugin loads and runs under OpenClaw plugin system
- Memory and Skills panels show actionable state for multiple agents
- Docs/README/specs fully reflect this OpenClaw-first architecture

## Risks

- Data-shape mismatches between UI assumptions and OpenClaw state formats
- Plugin safety issues if extension trust boundaries are weak
- Hard deletion of old backend paths may remove fallback debugging tools too early
- UI complexity can outpace MVP reliability if adapter contracts are not strict

## Release Slices

- **SC01**: OpenClaw state mapping contracts + adapter scaffolding
- **SC02**: Notion plugin packaged as in-repo OpenClaw extension
- **SC03**: UI memory/skills upgrade on top of adapter layer
- **SC04**: Session/chat bridge from office UI to OpenClaw gateway
