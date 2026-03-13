# Code Review: Optimistic Builder Layout Save

## Summary
- Files reviewed: 6
- Critical issues: 0
- Important issues: 1
- Suggestions: 0

## Critical Issues (must fix)
- None.

## Important Issues (should fix)
### Issue 1: Optimistic rollback can clobber unrelated in-flight settings updates
- **File**: `ui/src/components/office-scene/office-layout-save.ts:33`
- **Confidence**: 86
- **Problem**: On failed save, the helper restores the full `previousSettings` snapshot. If another surface updates office settings while this request is in flight (for example decor/view changes), rollback overwrites those newer fields and reintroduces stale values.
- **Fix**: Roll back only the fields owned by this operation (`officeLayout` and derived `officeFootprint`) using the latest current settings, or add version/request-id guarding so stale rollback/success writes are ignored when a newer settings write has already been applied.

## Suggestions
- None.

## Strengths
- Optimistic path is isolated in a dedicated helper with clear tests for success and `ok: false` rollback behavior.
- Error messages remain surfaced in the editor instead of failing silently.

## Recommended Actions
1. Make rollback field-scoped (layout + footprint only) or version-aware.
2. Add a concurrency regression test covering "layout save fails while another settings update lands".
3. Re-run review after the conflict-resolution guard is in place.
