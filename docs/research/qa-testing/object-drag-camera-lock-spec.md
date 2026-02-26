# Object Drag + Camera Lock Spec

Date: 2026-02-26  
Scope: `ui/src/features/office-system/components/interactive-object.tsx`

## Expected Interaction States

```text
IDLE
- Builder mode may be on/off
- Orbit camera controls available
- No object drag indicator

DRAGGING (after Move mousedown and hold)
- Selected object follows pointer
- Global dragging state = true
- Orbit controls rotate/pan disabled
- Drag indicator visible under object

RELEASED (on mouseup)
- Object position persists to adapter
- Global dragging state = false
- Orbit controls rotate/pan re-enabled
- Drag indicator hidden
```

## Camera Lock Contract

- While dragging: `OrbitControls.enabled === false`
- After release: `OrbitControls.enabled === true`

## Regression Guard

- Drag start must not be cancelled by controller re-initialization during drag.
- Controller lifecycle must remain stable across local drag state updates.
