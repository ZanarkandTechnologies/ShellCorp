# QA Agent Guide

Repo-local guide for ticket-scoped QA. This mirrors the current QA agent contract so testing stops improvising around the codebase.

## Core Rule

Every meaningful QA pass should produce ticket-scoped evidence under `docs/research/qa-testing/`.

Recommended layout:

```text
docs/research/qa-testing/<TICKET_ID>/YYYY-MM-DD_HHMMSS_<topic>/
  report.md
  snapshot.json
  screens/*.png
  logs/console.txt
  logs/errors.txt
```

If no ticket exists yet, create the ticket first. Do not treat freeform chat as the only QA contract.

## Required Context Before QA

Read, in order:

1. the delegated ticket file or the active ticket in `tickets/building/`
2. the ticket `Agent Contract`
3. the ticket `Evidence Checklist`
4. `docs/TASTE.md` when UI quality is in scope
5. any product-specific runbook linked by the ticket

For the office UI, use [`docs/how-to/ai-office-ui-qa-runbook.md`](/home/kenjipcx/Zanarkand/ShellCorp/docs/how-to/ai-office-ui-qa-runbook.md) as the domain-specific interaction map.

## Office QA Shortcuts And Hooks

The office now exposes a keyboard-first QA layer for global panel access. Treat this file as the canonical QA-memory surface for those hooks.

### Command Palette

- `Cmd/Ctrl+K` opens the office command palette.
- The palette searches shared registry labels, descriptions, and keywords.
- Selecting a result opens the real panel through the same HUD/store path used by the menu.

### Global Panel Shortcuts

- `Alt+Shift+O` -> `organization`
- `Alt+Shift+T` -> `team-workspace`
- `Alt+Shift+A` -> `agent-session`
- `Alt+Shift+S` -> `global-skills`
- `Alt+Shift+C` -> `ceo-chat`
- `Alt+Shift+W` -> `ceo-workbench`
- `Alt+Shift+R` -> `human-review`
- `Alt+Shift+B` -> `builder-mode`
- `Alt+Shift+D` -> `office-shop`
- `Alt+Shift+P` -> `settings`

Guardrails:

- These shortcuts are intended for the office view.
- They should not fire while focus is inside `input`, `textarea`, `select`, or `contenteditable` surfaces.
- They are backed by the shared office panel registry, not a QA-only state path.

### Dev-Only QA Bridge

In development builds:

```ts
window.__SHELLCORP_QA__.listPanels();
window.__SHELLCORP_QA__.openPanel("agent-session");
window.__SHELLCORP_QA__.runCommand("builder-mode");
```

Contract:

- `listPanels()` returns the supported global panel ids, labels, descriptions, and shortcut hints.
- `openPanel(id)` succeeds only for registry items classified as panels.
- `runCommand(id)` also allows non-panel registry actions.
- Invalid ids return `false`.

### Recommended Office QA Order

For panel-level smoke checks:

1. Prefer shortcut or palette open over canvas clicking.
2. Use the dev bridge when deterministic scripted access is more reliable than keyboard simulation.
3. Fall back to the office runbook only for context-heavy in-world actions such as employee radial menus or team-cluster clicks.

## Required Ticket Fields

UI-bearing tickets should define:

- `Open`
- `Test hook`
- `Stabilize`
- `Inspect`
- `Key screens/states`
- `Taste refs`
- `Expected artifacts`
- `Delegate with`

If the ticket lacks a usable `Test hook` or the screen/state targets are vague, stop and report `underspecified QA` or `missing test hook` instead of inventing a brittle flow.

## Browser Workflow

Prefer `agent-browser` for quick evidence capture:

```bash
RUN_DIR="docs/research/qa-testing/<TICKET_ID>/$(date -u +%F_%H%M%S)_smoke"
mkdir -p "$RUN_DIR/screens" "$RUN_DIR/logs"

agent-browser open http://localhost:3000
agent-browser snapshot -i -c --json > "$RUN_DIR/snapshot.json"
agent-browser screenshot "$RUN_DIR/screens/page.png"
agent-browser console > "$RUN_DIR/logs/console.txt" || true
agent-browser errors > "$RUN_DIR/logs/errors.txt" || true
```

Rules:

- refresh refs after navigation or DOM changes
- do not retry the same broken DOM interaction more than twice
- on unexpected browser failure, immediately capture screenshot, snapshot, console, and errors

## Reconciliation Contract

The QA report and the ticket should both reconcile:

- each acceptance criterion -> `PASS | FAIL | NOT PROVABLE`
- each declared screen/state -> `PASS | FAIL | NOT PROVABLE`
- each evidence item -> `CAPTURED | MISSING`

If something is not provable from artifacts, mark `NOT PROVABLE`. Do not guess.

## Report Shape

Each `report.md` should stay compact and include:

- `Ticket`
- `Evidence checklist status`
- `Ticket reconciliation`
- `Screens covered`
- `Verdict`
- `Acceptance criteria status`
- `Top visual diffs`
- `Top behavior diffs`
- `Missing instrumentation`
- `What to automate next`
- `Artifacts`

## Testability Rule

If agentic QA is hard because the app is dynamic, canvas-heavy, or requires hidden setup, add explicit testability work to the ticket instead of pushing the pain into QA. Typical fixes:

- stable deep links
- deterministic seed/reset helpers
- pause/step controls
- DOM mirrors or debug overlays
- stable panel shortcuts

UI work is not done if agents still cannot prove it reliably.
