# SC13: QA Panel Access Instrumentation

## Scope

Define a deterministic access layer for ShellCorp's office panels so QA agents and keyboard-heavy operators can open global surfaces without relying on fragile scene clicks or speed-dial traversal.

This first slice is global-panel-only. Context-heavy employee, team, and object actions remain follow-up scope.

## Problem

The office UI is intentionally spatial and click-driven, but repeatable panel testing is slower and more fragile than it should be:

- some surfaces still require precise 3D hit-testing or menu traversal
- browser-agent QA spends time on navigation instead of verification
- there is no single source of truth for "what can be opened directly"

The product need is not a second navigation shell. It is an instrumentation layer that reuses the real UI state model.

## Audience

- Browser-agent QA flows that need deterministic panel access
- Founders/operators who prefer keyboard-first navigation
- Developers debugging office panel routing and state

## JTBD

When I need to inspect or test a specific ShellCorp panel, I want a fast keyboard-first way to open it directly, so I can verify behavior without relying on scene clicks or repeated menu traversal.

## Product Rules

- Global office launchers must route through one shared panel registry.
- Keyboard shortcuts, command-palette actions, and dev-only QA helpers must call the same registry actions.
- The registry must reuse real store/chat open paths; no QA-only panel state is allowed.
- Keyboard shortcuts must not intercept keystrokes while focus is inside a text input, textarea, select, or contenteditable surface.
- Dev-only QA helpers must be absent or inert in production builds.

## First Slice

Ship:

- shared registry for top-level office actions and panels
- keyboard shortcuts for the highest-value global surfaces
- searchable `Cmd/Ctrl+K` command palette
- dev-only `window` QA bridge for deterministic scripted opens
- QA-facing docs listing registry ids and shortcuts

Do not ship yet:

- context-aware commands like "open team <name>"
- employee radial-action shortcuts
- object runtime/deep-link routing
- new persistent left navigation

## Supported Global Targets

- `organization`
- `team-workspace`
- `agent-session`
- `global-skills`
- `ceo-chat`
- `ceo-workbench`
- `human-review`
- `office-shop`
- `settings`

Optional non-panel registry actions may also exist for discoverability, such as `builder-mode` or navigation back to landing.

## Interaction Contract

### Keyboard

- `Cmd/Ctrl+K` opens the command palette.
- Global panel shortcuts may use a shared modifier pattern, but must avoid browser-default collisions as much as practical.
- Triggering a shortcut for an already-open panel must behave deterministically.

### Command Palette

- Lists supported registry actions with human-readable labels and optional shortcut hints.
- Searches across labels, descriptions, and keywords.
- Selecting an item calls the same registry action used by the menu/shortcut path.

### Dev QA Bridge

- Development builds expose a small global helper for deterministic panel opening.
- The helper returns a stable success/failure result for valid vs invalid ids.
- Invalid ids fail safely and do not throw uncaught runtime errors in normal use.

## Required Implementation Shape

- Keep the registry close to the office HUD and make it the source of truth for:
  - speed-dial entries
  - command-palette entries
  - shortcut bindings
  - dev-only QA bridge ids
- Prefer additive composition over moving panel logic into a new router layer.
- Document the shortcut map and QA helper in the office QA runbook.

## Acceptance Criteria

1. A QA operator can open supported global panels from the keyboard without any pointer interaction.
2. `Cmd/Ctrl+K` opens a searchable command palette and selecting an item opens the expected panel.
3. Shortcut handling does not steal input while focus is inside text-entry surfaces.
4. A dev-only QA helper can open supported panels by id through the same registry actions.
5. The registry is the shared source of truth for menu, palette, and shortcut metadata.

## Backpressure / Evidence

- Focused tests cover shortcut matching, editable-target guarding, and registry action wiring.
- Typecheck passes.
- QA runbook documents the shipped shortcuts and helper ids.
- Visual QA verifies palette rendering and at least one shortcut-driven panel open path.
