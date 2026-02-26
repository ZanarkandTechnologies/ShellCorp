# Observed Snapshot Report: Menu + Drag

Date: 2026-02-26  
Environment: local Vite app at `http://127.0.0.1:5175/`  
Method: browser automation + source verification

## Office Menu Observations

- Menu opens from top-left and shows expected parity stack.
- Existing items present: Back to Landing, Builder Mode, Team Panel, Agent Session Panel, Skills Panel, Settings.
- Added items present: User Tasks, Recruit Agent, Shop, Manage Teams, Team Directory, Manage Tools, Manage Skills.
- In OpenClaw-only mode:
  - `Recruit Agent`, `Manage Teams`, `Manage Tools` are shown as disabled ("Coming Soon").
- `User Tasks` dialog opens/closes without crashing.
- `Manage Skills` dialog opens/closes without crashing.

## Placement + Modal Closure Observations

- Opening `Shop` and triggering placement closes menu-driven modal surfaces.
- Placement confirmation panel appears and can be cancelled.

## Drag/Camera Observations

- Builder mode toggle and top-down transition work.
- Full drag confirmation is partially blocked in browser automation because canvas mesh-level hit testing is not reliably automatable.
- Code path and runtime do not show crash/regression after drag lifecycle stabilization changes.

## Manual Follow-up Needed

- Human verification of the exact move-hold interaction on a selected 3D object:
  - Hold `Move`
  - Drag object across floor
  - Confirm camera lock during drag and unlock on release
