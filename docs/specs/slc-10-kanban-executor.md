# Spec: Kanban Executor Agent

**Status**: Draft
**Created**: 2026-02-23
**Author**: gpt-5.3-codex

## Problem

Teams can capture priorities in a kanban board, but work still stalls because context gathering, execution, and verification are manual and fragmented across tools.

## Solution

Introduce a dedicated Kanban Executor Agent loop that:

1. Selects the highest-priority executable card.
2. Gathers context through ontology contracts and skill/tool calls.
3. Produces an execution plan with explicit safety gates.
4. Executes directly or delegates computer work through controlled subprocesses.
5. Verifies outcomes, updates source systems, and closes/reports the card.

## Success Criteria

- [ ] SC-1: Executor can lease one kanban item at a time with idempotent run identity.
- [ ] SC-2: Context pack is assembled from ontology + memory + channel evidence before execution.
- [ ] SC-3: High-impact actions require confidence/approval gates before external writes.
- [ ] SC-4: Execution can use delegated subprocesses (`opencode`, `oagi`) without blocking gateway responsiveness.
- [ ] SC-5: Completion requires verification evidence and produces status update + summary output.
- [ ] SC-6: Every run emits structured logs with correlation IDs for Event -> Decision -> Action -> Outcome replay.

## Out of Scope

- Autonomous reprioritization of the entire organization backlog without policy constraints
- Multi-host distributed work stealing and consensus scheduling

## Technical Approach

- **Input contract**: canonical kanban item schema (`id`, `title`, `priority`, `goalId`, `assigneePolicy`, `acceptanceCriteria`, `sourceRefs`).
- **Lease model**: optimistic lease with TTL and heartbeat refresh to prevent duplicate execution.
- **Context resolver**: pull canonical entities (`task`, `project`, `goal`, `crm`) plus relevant memory entries and channel artifacts.
- **Planner step**: produce executable steps with tool/skill requirements and rollback path.
- **Executor step**: run direct tool calls or delegated subprocesses, capturing run metadata and artifacts.
- **Verifier step**: assert acceptance criteria and write completion details back via ontology/gateway APIs.
- **Reporter step**: emit outbound updates (thread reply, DM, board comment) and observability records.

## Data Contracts

- `kanban.executor.pull`: returns next runnable item and lease token.
- `kanban.executor.heartbeat`: extends active lease.
- `kanban.executor.complete`: writes success/failure outcome with evidence.
- `kanban.executor.release`: releases lease on abort/timeout.

## Safety Constraints

- Executor cannot perform irreversible writes without policy + confidence checks.
- Low-confidence mapping/tool results force clarification or approval workflow.
- Lease expiration must auto-release work to avoid stuck items.
- Source system writes must be idempotent by external correlation key.

## Open Questions

1. Should lease arbitration live in local file state (SLC-1) or Convex (SLC-2)?
2. What is the minimum evidence set required to mark a card as completed?
3. Which card classes are always human-approval-gated regardless of confidence?
