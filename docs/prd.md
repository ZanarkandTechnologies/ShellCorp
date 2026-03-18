# Product Requirements Document: Shell Company

**Status**: Draft  
**Created**: 2026-02-21  
**Updated**: 2026-03-17  
**Author**: gpt-5.3-codex

## Documentation Indexes

- OpenClaw Multi-Agent Routing: https://docs.openclaw.ai/concepts/multi-agent#multi-agent-routing
- OpenClaw Plugins: https://docs.openclaw.ai/tools/plugin#plugins

## Job To Be Done

When a founder runs a small autonomous company on one VPS, they need a minimal office that lets them ask the CEO agent to shape work on the board, review tickets in a clear lane, approve execution, and inspect active work without rebuilding the underlying agent runtime.

## Audience

- Founders and small teams already running OpenClaw on a VPS
- Operators who need a compact way to create and steer small teams
- Teams that prefer local state directories over additional hosted infrastructure

## Problem

OpenClaw already solves agent runtime, routing, and plugin loading. The missing layer is not a huge simulated company. It is a founder control surface that turns CEO-led team formation and small-team oversight into a clean, repeatable workflow.

## Solution

Build Shell Company as a UI-first control center on top of OpenClaw:

1. **State mapping layer**: map OpenClaw state directories and gateway APIs into UI view models.
2. **Minimal office UX**: keep the office metaphor, but optimize it for a small number of meaningful surfaces instead of a crowded default company.
3. **Plugin-first integrations**: package Notion logic as an OpenClaw plugin instead of internal gateway code.
4. **Board-native planning workflow**: make CEO chat, kanban ticket creation, markdown task memory, review-lane human sign-off, and CLI-backed execution the primary product path.
5. **Operational surfaces**: improve memory and skill visibility for the active CEO/team workflow.
6. **Federated work orchestration**: unify external board work (Notion/Vibe/internal) into one operator surface.
7. **Personalized presence and decor**: let operators style the office after the core founder-control loop is working.
8. **Roster-first team oversight**: each team surface should show who each agent is, what they are doing now, and keep team coordination anchored to ticket activity and task memory instead of chat-style team conversation.

## State Shape Rule

ShellCorp should only keep strong structure where routing and synchronization require it.

- Kanban/task identity, ordering, ownership, approval state, and session linkage stay structured.
- Rich task and project working state should default to markdown text that humans and agents can rewrite directly.
- Execution history should prefer append-only logs over mutable workflow objects.
- Shared team/project memory should prefer append-only realtime logs with markdown bodies, while task-local working memory can stay on the task itself.

This product should not invent a large proposal/config schema when a board task plus markdown body can carry the workflow.

## Core Platform Behaviors

- OpenClaw remains the system-of-record for agents, sessions, and routing
- UI reads from `~/.openclaw/agents/*`-derived state (through adapters) plus OpenClaw gateway APIs
- Agent and session topology follows OpenClaw multi-agent bindings
- Notion integration is shipped as an in-repo OpenClaw plugin
- Chat actions from UI are bridged back to OpenClaw gateway APIs
- Task and project execution memory should stay inspectable as markdown-first working state with append-only audit logs

## MVP Focus

Single VPS, one shared OpenClaw instance, a small number of active teams:

- Show the CEO and active team roster from OpenClaw state
- Support basic chat send/steer actions to OpenClaw
- Ship the board-native planning and review loop as the main office workflow
- Show per-team board/activity context for newly created teams
- Make team oversight legible at a glance with compact member presence cards that show face/avatar, live state, latest task context, and quick actions
- Make team oversight legible through a roster-first Overview plus a shared append-only Memory log tied to ticket execution and team decisions
- Ship Notion plugin in-repo and wired for MVP workflows
- Ship practical Memory and Skills panels for active operators, not broad office clutter

## Phase 2 Expansion Focus

After MVP baseline stabilizes, Shell Company extends from "minimal founder-control office" to a broader autonomous company cockpit:

- Keep operators in their preferred external tools (Notion/Vibe) while showing one unified mission view in Shell Company.
- Treat ticket lifecycle and agent-session lifecycle as linked operational primitives.
- Convert provider data structures into reusable context tools/skills for agent execution.
- Expose heartbeat/cron autonomy loops with explicit operator intervention controls.
- Expand personalization and aesthetic identity (2D/3D/pixel styles, profile presence, office decor wrappers).

## Goals

- Make board-native planning, review, and team formation the primary product value
- Keep the office small, readable, and useful by default
- Provide reliable session and agent observability from real OpenClaw state
- Keep CLI and sidecar state thin: structured for board mechanics, markdown-first for working content
- Make it easy to identify each agent on a team by face/avatar, role, and current work without opening separate panels first
- Package Notion integration as an OpenClaw extension with schema-driven config
- Keep architecture simple: local VPS state first, no mandatory external DB
- Make per-agent sandbox and tool policy visible in UI
- Provide federated Kanban visibility across internal and external work providers
- Support canonical-provider-per-project sync policy for external workflow continuity
- Make ticket-to-session lifecycle visible and controllable from the operator surface
- Support provider indexing and context-tool generation for stronger autonomous execution
- Deliver meaningful agent personalization controls without degrading operational reliability

## Non-Goals

- Rebuilding custom gateway/routing/config runtime that duplicates OpenClaw
- Building a generic public multi-tenant SaaS in this MVP
- Large connector marketplace beyond Notion in first slice
- Replacing OpenClaw core session/routing internals
- Building proposal-specific command flows or data models when shared board metadata plus markdown task memory is sufficient
- Rebuilding full Notion/Vibe UX inside Shell Company
- Shipping a large default office full of prebuilt teams just to make the UI feel busy
- Attempting fully automatic multi-master conflict resolution in first federation slice

## Constraints

- TypeScript-first implementation
- OpenClaw-compatible architecture and terminology
- In-repo plugin development model for fast iteration
- Spec-first workflow for major scope changes
- Security-first defaults for plugin trust and secret handling
- Prefer markdown/file-backed working state over new structured workflow stores unless routing or sync genuinely requires schema
- Demo defaults should bias toward a tiny office and a small number of meaningful teams
- External-provider write ownership must remain explicit and deterministic per project
- Sync behavior must be observable/auditable in UI with failure states surfaced to operators
- Personalization assets must not block agent/runtime orchestration features

## Success Metrics

- Founders can review work by lane on the kanban board, approve through the `review` lane, and execute team/bootstrap work through ShellCorp CLI
- Operators can view the CEO and active teams from OpenClaw-backed data
- Session timeline and chat bridge work for at least one real founder-to-team flow
- Team overview surfaces show current agent presence with face/avatar, live state, and latest owned task context
- Founders can inspect team work through a shared append-only Memory tab while using direct agent chat only for explicit operator intervention
- Notion plugin loads and runs under OpenClaw plugin system
- Memory and Skills panels show actionable state for the CEO and active demo teams
- Docs/README/specs fully reflect this OpenClaw-first architecture
- Operators can track combined board activity from multiple providers in one ShellCorp view
- Operators can close tickets through a clear ticket=session lifecycle rule with explicit close semantics
- Provider indexing can generate reusable context tools with deterministic command naming
- Heartbeat/autonomy state is visible with pause/resume/manual-run controls and traceability

## Risks

- Data-shape mismatches between UI assumptions and OpenClaw state formats
- Plugin safety issues if extension trust boundaries are weak
- Hard deletion of old backend paths may remove fallback debugging tools too early
- UI complexity can outpace MVP reliability if the product keeps too many office surfaces active at once
- Federation sync conflicts can cause operator confusion if ownership rules are ambiguous
- Scope expansion across orchestration + personalization can reduce shipping velocity
- Provider schema drift can break context-indexed tool generation if contracts are too loose

## Release Slices

- **SC01**: OpenClaw state mapping contracts + adapter scaffolding
- **SC02**: Notion plugin packaged as in-repo OpenClaw extension
- **SC03**: UI memory/skills upgrade on top of adapter layer
- **SC04**: Session/chat bridge from office UI to OpenClaw gateway
- **SC05**: Live OpenClaw endpoint wiring and stabilization on VPS
- **SC06**: Kanban federation and sync policy (Notion/Vibe/internal board)
- **SC07**: Ticket-session lifecycle model (`ticket == session until close`)
- **SC08**: Provider context indexing and generated context-tool/skill catalog
- **SC09**: Agent personalization and Mesh/Image wrapper integration model
- **SC10**: Heartbeat-driven autonomy loop visualization and operator governance
