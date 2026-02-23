# Spec: Channel Observer Agent

**Status**: Draft
**Created**: 2026-02-23
**Author**: gpt-5.3-codex

## Problem

Important project signals are buried in channel traffic. Without a dedicated observer, blockers, ownership gaps, and execution risks are discovered too late.

## Solution

Run a Channel Observer Agent that processes configured conversation streams and emits structured operational outputs:

1. Workflow events (new task, dependency, ownership change, deadline risk).
2. Blocker events (blocked task, missing decision, waiting-on external actor).
3. Action recommendations (who to tag, what context to gather, what kanban card to create/update).

## Success Criteria

- [ ] SC-1: Observer ingests configured channel scopes (`none | mentions | allowlist | sampled | full`).
- [ ] SC-2: Observer emits typed workflow events with provenance and confidence.
- [ ] SC-3: Blockers are detected with suggested owner/tag targets and evidence links.
- [ ] SC-4: High-confidence findings can create/update kanban items via canonical contracts.
- [ ] SC-5: Low-confidence findings require approval before durable memory promotion or external write actions.
- [ ] SC-6: Observer decisions/actions are fully logged with correlation IDs for replay.

## Out of Scope

- Fully autonomous personnel management or performance scoring
- Private direct-message surveillance outside explicit policy scope

## Technical Approach

- **Input sources**: normalized gateway events + optional polling sources from connected providers.
- **Policy filter**: enforce channel allowlists, privacy scopes, and observer mode before analysis.
- **Extraction pipeline**: classify conversation segments into workflow entities (`task`, `project`, `goal`, `crm`) and risk markers.
- **Blocker model**: identify blocking condition, impacted entity, likely owner, urgency, and recommended next action.
- **Outputs**:
  - `observer.event.emit`
  - `observer.blocker.emit`
  - `kanban.item.upsert` (gated)
  - `memory.observation.append`
- **Feedback loop**: executor outcomes feed observer quality metrics and heuristic tuning.

## Safety Constraints

- Observer cannot trigger privileged writes without policy + confidence gates.
- PII-sensitive channels require explicit opt-in and stricter retention limits.
- All extracted statements keep source references for operator verification.
- Mention/tag recommendations require permission checks before outbound dispatch.

## Open Questions

1. Should observer run continuously or in micro-batches per channel/provider?
2. What default confidence threshold should allow automatic kanban upsert?
3. Which channel categories should be hard-blocked from observation in SLC-1?
