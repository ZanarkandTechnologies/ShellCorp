# Code Review: builder-layout investigation

## Summary
- Files reviewed: 7 (4 with active diffs)
- Critical issues: 0
- Important issues: 2
- Suggestions: 0

## Critical Issues (must fix)
- None.

## Important Issues (should fix)
### Issue 1: Builder grid no longer maps 1:1 to room bounds on rectangular layouts
- **File**: `ui/src/components/debug/unified-grid-helper.tsx:60`
- **Confidence**: 88
- **Problem**: Builder-mode grid size now uses `Math.max(layoutBounds.width, layoutBounds.depth)`, which forces a square grid. For non-square layouts, the shorter axis shows extra phantom cells outside room bounds, so the visual grid is no longer a strict tile-for-tile representation of editable room tiles.
- **Fix**: Render a rectangular tile overlay for builder mode (or separate axis-aligned line sets) using independent X/Z extents from `layoutBounds.width` and `layoutBounds.depth`.

### Issue 2: Missing regression tests for non-square tile-aligned builder grid behavior
- **File**: `ui/src/lib/office-layout.test.ts:1`
- **Confidence**: 84
- **Problem**: The investigation change introduces a new invariant (MEM-0173) around tile-aligned builder visualization, but there is no test coverage for non-square layout bounds and no component-level regression check for `SmartGrid`/`UnifiedGridHelper` mode behavior.
- **Fix**: Add a focused test that covers rectangular layouts (e.g., width != depth) and asserts builder grid extents align to layout bounds without extra editable-looking cells; include a `mode='both'` case.

## Suggestions
- None.

## Strengths
- The new header block and memory references in `unified-grid-helper.tsx` and office-scene module docs make the new builder invariant explicit.
- Existing `office-layout` tests already cover enclosed-fill/removal stroke expansion logic, which reduces risk in core tile math.

## Recommended Actions
1. Fix grid extent computation so builder visualization reflects true room width/depth.
2. Add regression tests for rectangular layout visualization and mixed (`both`) mode behavior.
3. Re-run review after fixes.
