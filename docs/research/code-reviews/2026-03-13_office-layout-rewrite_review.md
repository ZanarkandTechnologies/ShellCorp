# Code Review: Office Layout Rewrite

## Summary
- Files reviewed: 7 (plus wiring/tests for validation)
- Critical issues: 2
- Important issues: 2
- Suggestions: 0

## Critical Issues (must fix)
### Issue 1: Office layout updates can be dropped by provider stabilization
- **File**: `ui/src/providers/office-data-provider.tsx:374`
- **Confidence**: 97
- **Problem**: `buildOfficeSettingsSignature` does not include `officeLayout.tiles` (or any layout shape hash), only `officeFootprint` width/depth + decor/view fields. If layout shape changes while bounds stay the same, `stabilizeOfficeData` treats settings as unchanged and reuses stale `current.officeSettings`, so scene/layout consumers can miss updates.
- **Fix**: Include a deterministic layout signature in `buildOfficeSettingsSignature` (e.g., `settings.officeLayout.tiles.join(',')` and version/tileSize), or compare `officeLayout` directly in stabilization.

### Issue 2: Nested ternary in builder tool mode selection violates repo review contract
- **File**: `ui/src/components/office-scene/office-layout-editor.tsx:57`
- **Confidence**: 99
- **Problem**: `paintMode` is assigned via nested ternary (`paint-floor ? ... : remove-floor ? ... : null`). The review contract explicitly forbids nested ternaries.
- **Fix**: Replace with an `if/else` chain or small helper function returning `"add" | "remove" | null`.

## Important Issues (should fix)
### Issue 1: “Keep management area” validation is currently ineffective
- **File**: `ui/src/components/office-scene/office-layout-editor.tsx:120`
- **Confidence**: 88
- **Problem**: Removal validation computes `managementAnchor` via `getManagementAnchorFromOfficeLayout(candidate)`, which already clamps to a valid tile. The next check (`isPositionInsideOfficeLayout(managementAnchor, candidate, 0)`) is therefore tautologically true and does not protect any specific management zone.
- **Fix**: Validate against an unclamped expected management-zone target (or a required zone mask) before accepting tile removal.

### Issue 2: Pathfinding footprint obstacle mapping still assumes centered origin
- **File**: `ui/src/features/nav-system/pathfinding/a-star-pathfinding.ts:157`
- **Confidence**: 85
- **Problem**: In the `obstacle.userData.footprint` branch, grid coordinates are computed with `point + floorWidth/2` / `point + floorDepth/2`. For shifted/non-centered layouts, this diverges from the new `worldMinX/worldMinZ` coordinate system and can mark wrong obstacle cells.
- **Fix**: Convert footprint points through `worldToGrid(point.x, point.z)` (or equivalent `worldMinX/worldMinZ` math) instead of `floorWidth/2` offsets.

## Strengths
- Tile-based layout normalization and backward compatibility fallback are covered by focused tests (`office-layout` + `normalize-office-settings`).
- Placement now checks actual layout occupancy rather than fixed floor size.
- Nav grid conversion to `worldMinX/worldMinZ` is directionally correct for irregular/offset layouts.

## Recommended Actions
1. Fix provider office-layout signature stabilization first (this can hide persisted layout edits).
2. Fix management-zone validation semantics in tile removal.
3. Align footprint obstacle conversion with `worldMinX/worldMinZ` mapping.
4. Replace nested ternary in `paintMode` with explicit branching.
5. Add regression tests for (a) same-bounds/different-shape provider updates and (b) shifted-layout footprint obstacle mapping.
