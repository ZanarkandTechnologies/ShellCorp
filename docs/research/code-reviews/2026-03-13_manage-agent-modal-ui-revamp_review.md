# Code Review: Manage-Agent Modal UI Revamp

## Summary
- Files reviewed: 4
- Critical issues: 0
- Important issues: 2
- Suggestions: 0

## Important Issues (should fix)
### Issue 1: Agent portrait ignores available identity avatar fields
- **File**: `ui/src/features/office-system/components/manage-agent-modal/overview-display.ts:106`
- **Confidence**: 89
- **Problem**: `avatarUrl` resolution only checks `selectedAgent.identity.avatarUrl` and `employee.profileImageUrl`. It ignores `identity.avatar` and `selectedAgent.identity.avatar`, even though those are part of the adapter/type contract. Result: the new portrait panel can show fallback initials/emoji even when avatar data exists.
- **Fix**: Include avatar fallback precedence such as: `identity.avatar` and `selectedAgent.identity.avatar` before falling back to `employee.profileImageUrl` (or extend the identity type to include `avatarUrl` and use that first).

### Issue 2: Tab trigger styling is duplicated six times, increasing drift risk
- **File**: `ui/src/features/office-system/components/manage-agent-modal/index.tsx:624`
- **Confidence**: 82
- **Problem**: The same long class string is repeated for each `TabsTrigger`. This increases maintenance risk for future token or accessibility updates and makes regressions likely when one tab is edited differently.
- **Fix**: Extract a single `const manageAgentTabTriggerClass = "..."` (or helper component) and reuse it across all six triggers.

## Strengths
- The refactor keeps the existing data flow and save behavior intact while isolating display derivation in a pure helper (`overview-display.ts`).
- New helper logic is covered by focused tests and includes deterministic fallback precedence for name/status.
- No silent catch blocks or broad exception suppression introduced in the reviewed files.

## Recommended Actions
1. Patch avatar fallback precedence in `overview-display.ts` and add a test that proves avatar resolution from `identity.avatar`.
2. Deduplicate tab trigger classes in `index.tsx` to reduce UI drift risk.
3. Re-run targeted tests and do a quick keyboard navigation pass on the modal tabs after the cleanup.
