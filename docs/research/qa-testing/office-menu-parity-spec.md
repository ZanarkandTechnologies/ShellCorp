# Office Menu Parity Spec

Date: 2026-02-26  
Scope: `ui/src/components/hud/office-menu.tsx`

## Expected Menu Stack

When menu is opened from the top-left trigger, items appear in this vertical list:

```text
[Back to Landing]
[Builder Mode]
[User Tasks]
[Team Panel]
[Agent Session Panel]
[Recruit Agent]   (may be disabled in OpenClaw-only mode)
[Shop]
[Manage Teams]    (may be disabled in OpenClaw-only mode)
[Team Directory]
[Manage Tools]    (may be disabled in OpenClaw-only mode)
[Skills Panel]
[Manage Skills]
[Settings]
```

## Expected Dialog Behavior

- Clicking `User Tasks` opens a modal and closes cleanly.
- Clicking `Manage Skills` opens a modal and closes cleanly.
- Clicking `Shop` opens Furniture Shop modal.
- If placement mode becomes active, open menu-driven modals close automatically.

## OpenClaw-Only Compatibility

In this workspace mode, Convex management actions may be visible but disabled:

- `Recruit Agent`
- `Manage Teams`
- `Manage Tools`

Disabled state should remain stable and not crash the page.
