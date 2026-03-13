# Office Scene Module

## Boundaries
- Keep `office-scene.tsx` as the public scene entrypoint and canvas shell only.
- Put data shaping, bootstrap timing, and large render switches in this module folder.
- Avoid adding new scene-global store writes directly in presentational render components.

## Invariants
- Scene bootstrap is coordinated through explicit readiness signals, not ad hoc local loaders.
- Office object registration and nav-grid initialization stay coupled through one bootstrap hook.
- Pure derived scene data should remain testable without mounting React Three Fiber.
- View switching is settings-backed and presentation-only: camera/profile changes may alter render-time orientation, but they must not rewrite persisted office-object transforms.
- Room decor is split by responsibility: floor pattern and wall color live in `officeSettings.decor`, while wall paintings stay as fixed-slot `wall-art` objects so resizing the office re-anchors cosmetics without blocking navigation.
- Room shape is tile-backed under `officeSettings.officeLayout`; any builder/nav/render change must derive occupancy and exposed walls from that layout, while `officeFootprint` remains only a derived bounding box for compatibility. `MEM-0172`
- Builder-mode drag editing must rasterize every crossed tile and the visible builder grid must stay 1:1 with office layout tiles, otherwise preview/fill behavior becomes misleading. `MEM-0173`
- Office-settings persistence bridges must round-trip `officeLayout` intact; if a bridge only keeps `officeFootprint`, builder apply/removal will snap back to a rectangle after save. `MEM-0174`
- Builder-mode layout saves should apply `officeSettings` optimistically and roll back on failure, rather than waiting for a refresh or server echo before the scene updates. `MEM-0175`

## Tests
- Prefer pure tests for derived-data helpers.
- Validate bootstrap behavior through focused unit tests before relying on browser-only checks.

## Conventions
- Major logic files need the standard header block.
- Keep extracted modules small and single-purpose; do not replace one god file with several medium god files.
