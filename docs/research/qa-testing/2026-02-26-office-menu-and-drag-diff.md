# Diff Report: Expected vs Observed

Date: 2026-02-26

## Against `office-menu-parity-spec.md`

- Match: expected menu entries are present.
- Match: User Tasks and Manage Skills dialogs open and close.
- Match: placement activation closes open menu-driven modals.
- Intentional variance: Convex-dependent actions are disabled in OpenClaw-only mode to avoid runtime failures.

## Against `object-drag-camera-lock-spec.md`

- Match: drag lifecycle stabilization implemented to avoid controller teardown during drag.
- Match: camera-lock contract remains wired via global dragging state in scene controls.
- Partial verification gap: end-to-end pointer drag over Three.js object is manual-only in current automation; no automated visual assertion for mesh drag path.

## Conclusion

- Spec alignment is strong for menu parity and modal behavior.
- Drag/camera behavior has code-level and partial runtime validation; one manual scenario remains required for final sign-off.
