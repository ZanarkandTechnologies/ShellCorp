# Code Review: SC12 Proposal Workflow (CLI + User Tasks + CEO Workbench)

## Summary
- Files reviewed: 12
- Critical issues: 2
- Important issues: 3
- Suggestions: 0

## Critical Issues (must fix)

### Issue 1: Proposal execution bypasses founder decision state
- **File**: `cli/team-commands/team-proposal.ts:408`
- **Confidence**: 95
- **Problem**: `team proposal execute` does not require `approvalStatus === "approved"`. A rejected or changes-requested proposal can still be executed as long as idea gate and role checks pass.
- **Fix**: Add a hard guard before execution:
  - reject execution unless `existing.approvalStatus === "approved"`,
  - return a clear error (`proposal_not_approved`),
  - add regression tests for `rejected` and `changes_requested` proposals.

### Issue 2: Permission model is too weak for execute path (privilege escalation)
- **File**: `cli/team-commands/team-proposal.ts:413`
- **Confidence**: 94
- **Problem**: `execute` enforces only `team.meta.write`, but it performs business config writes, OpenClaw skill sync writes, and board task writes. This bypasses the permission granularity defined in `TeamPermission`.
- **Fix**: Require all permissions needed by side effects:
  - `team.meta.write` (create team),
  - `team.business.write` (business config + skill sync),
  - `team.board.write` (proposal board bootstrap),
  - optionally `team.heartbeat.write` if heartbeat setup is touched.
  Add permission-denied tests for each capability.

## Important Issues (should fix)

### Issue 1: UI workflow still executes proposals directly, conflicting with SC12 contract
- **File**: `ui/src/components/hud/user-tasks-panel.tsx:113`
- **Confidence**: 88
- **Problem**: SC12 now specifies CEO-agent/CLI execution after founder approval (`docs/specs/SC12-spec-skill-orchestration-and-workflow-wizard.md:73`), but User Tasks still runs `adapter.executeTeamProposal(...)` directly from founder UI.
- **Fix**: Make User Tasks strictly a decision surface:
  - keep approve/reject/request-changes in UI,
  - remove direct execute action from founder panel,
  - let CEO agent (via skill + CLI) execute approved proposals.
  If immediate founder-triggered execution is intentionally retained, update SC12 + skill contract to match.

### Issue 2: Silent error swallowing in polling loops
- **File**: `ui/src/components/hud/office-menu.tsx:66`
- **Confidence**: 84
- **Problem**: polling for approvals/proposals uses empty `catch { /* ignore */ }`. This hides persistent adapter/gateway failures and removes debugging visibility.
- **Fix**: Add minimal error reporting path:
  - log structured warnings in dev mode,
  - surface non-blocking error state/badge in UI when polling repeatedly fails.

### Issue 3: CLI payload path allows empty capability skill IDs
- **File**: `ui/src/lib/team-proposal.ts:294`
- **Confidence**: 82
- **Problem**: `createTeamProposal` accepts empty-string `measure/execute/distribute` overrides because fallback uses nullish coalescing (`??`), not trimmed-empty checks. This can persist invalid business slot skill IDs and degrade downstream skill sync behavior.
- **Fix**: Normalize capability skill inputs with trim-or-default semantics:
  - `const measure = input...measure?.trim() || defaults...measure`,
  - same for `execute` and `distribute`.
  Add tests for empty-string overrides.

## Strengths
- Proposal lifecycle commands are cohesive and correctly integrated under `team proposal`.
- CEO desk click wiring and workbench panel integration are clean and localized.
- New proposal model has useful normalization coverage in adapter code.

## Recommended Actions
1. Block execution unless proposal is approved.
2. Tighten `execute` permission checks to match all side effects.
3. Align User Tasks behavior with SC12 contract (or explicitly revise spec).
4. Remove silent catches in new polling paths.
5. Add missing negative tests for approval-state and permission enforcement.
