# SC12: Skill Orchestration and Workflow Wizard (Deferred)

## Status

Deferred after SC11 demo slice.

## Purpose

Define a guided workflow that turns a business idea into:

- real-world operating research,
- recommended capability skills,
- automatic team/agent equip plan,
- and a simplified operator UX with low cognitive load.

## Why This Exists

SC11 delivers a demo-first execution path, but operators still need manual understanding of:

- which skills to choose,
- where to equip them,
- and how to validate that the team is actually ready.

SC12 captures the productized version of that flow.

## Scope

### In Scope

1. Business intake wizard in Team Panel.
2. Workflow discovery step ("how is this done in the real world").
3. Capability mapping step (`measure`, `execute`, `distribute`) with explainable suggestions.
4. Skill recommendation + compatibility checks against available managed skills.
5. One-click equip plan for PM/executor and optional role-specific overrides.
6. Readiness report with clear blockers and next actions.

### Out of Scope

1. Full autonomous content generation quality evaluation.
2. Marketplace-scale skill installation UX.
3. Multi-team/global optimization strategy.

## Primary UX Questions

1. Should business capability setup remain in `Business` tab, or move to per-agent management with a team-level wrapper?
2. How should "suggested" vs "equipped" vs "observed-in-runtime" be differentiated visually?
3. What minimum steps are required for a first-time operator to get to a valid loop in under 2 minutes?

## Technical Surfaces (Expected)

- `ui/src/features/team-system/components/business-*`
- `ui/src/features/office-system/components/manage-agent-modal.tsx`
- `ui/src/lib/openclaw-adapter.ts`
- `cli/team-commands.ts` (`team business` subcommands)
- `docs/prd.md` and follow-up memory/history entries

## Acceptance Targets

1. Operator can complete setup from idea to equipped agents in a single guided flow.
2. Wizard output is deterministic and auditable (clear generated skill mapping + reasons).
3. UI makes ownership obvious: team config, agent config, and runtime observed behavior are distinguishable.
4. No cross-team config contamination during auto-equip operations.
