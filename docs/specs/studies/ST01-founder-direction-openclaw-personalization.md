# ST01: Founder Direction Study - OpenClaw Personalization and Federated Workflows

## Context

This study captures founder direction for the next stage after baseline OpenClaw mapping and chat/memory/skills surfaces.

## Strategic Thesis

Shell Company should become a personalized autonomous company cockpit:

- Keep OpenClaw as runtime source of truth and execution engine.
- Create strong operator value through observability, comfort, and personalization.
- Let users continue working in external specialist tools (for example Notion/Vibe) while Shell Company aggregates and orchestrates.

## Value Pillars

1. Personalization-first operator experience:
   - Agent appearance/profile identity
   - Office aesthetic controls (2D/3D/pixel style directions)
   - Optional mesh/image wrappers to speed visual customization
2. Unified work observability:
   - Cross-agent board visibility in one place
   - Clear session and heartbeat status
   - Easier steering of autonomous work through a single control surface
3. Context amplification:
   - Index provider data sources
   - Generate reusable context commands/skills from those sources
   - Reduce context bottlenecks that block agent execution

## Product Direction Signals

- External workflow tools should remain first-class; Shell Company should not clone full Notion/Vibe UX.
- Federated Kanban is a near-term high-value step.
- Ticket lifecycle should align with session lifecycle where possible (`ticket == session until explicit close`).
- Heartbeat/autonomy loops should be visible and operable (pause/resume/manual controls with auditability).

## Recommended MVP Policy Decisions For Phase 2

- Use canonical-provider-per-project for board ownership.
- Maintain Shell Company as unified read and orchestration layer.
- Use deterministic conflict rules instead of multi-master merges in first slice.
- Start with explicit sync status surfaces before adding advanced automation.

## Open Questions (To Resolve In Specs)

- How fine-grained sync should be for comments, status, assignment, and labels?
- Which fields are always provider-owned versus Shell-owned metadata?
- Should ticket close always hard-close session, or allow policy overrides by project?
- How provider indexing versioning should be governed as schemas evolve?
- Which personalization assets are safe to support in first release without performance risk?

## Spec Outcomes

This study maps to the following spec tracks:

- `SC06`: Kanban federation and sync model
- `SC07`: Ticket-session lifecycle semantics
- `SC08`: Provider indexing and generated context tools
- `SC09`: Agent personalization and mesh/image wrapper strategy
- `SC10`: Heartbeat-driven autonomy loop governance
