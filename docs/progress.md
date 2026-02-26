# Shell Company MVP Progress

**Status**: in_progress  
**Date**: 2026-02-25

## Active Slice

UI-first OpenClaw mapping pivot:

| ID | Title | Status |
| --- | --- | --- |
| SC01 | OpenClaw state mapping contracts | completed |
| SC02 | In-repo Notion OpenClaw plugin scaffold | completed |
| SC03 | Memory + skills UI upgrade baseline | completed |
| SC04 | Chat bridge and session timeline baseline | completed |
| SC05 | Wire live OpenClaw endpoints on VPS | in_progress |

## Notes

- Legacy Fahrenheit gateway/config runtime has been intentionally removed from active scope.
- The product direction is now Office UI + OpenClaw state adapters.
- Office workspace HUD now includes Team (communication handoff, kanban, business/KPI), Agent Session, Skills, and Settings tabs with shared app-store navigation and scene click routing.
- Settings access is restored through tab-aware modal controls, and agent/team click intents now open the matching workspace context instead of isolated dialogs.
- Parity migration in progress: chat/computer/manage-agent/training now route through dedicated Zanarkand-style modals with one-trigger-to-one-modal behavior.
- Added frontend-safe OpenClaw compatibility hooks for chat context/messages so UI parity ships before full backend feature parity.
- Restored broken office interactions: employee Chat now reliably opens ChatDialog above scene overlays, employee Tasks now routes to owner-focused Kanban, and team-cluster clicks open a dedicated Team Panel shell.
- Added OpenClaw-backed Team Panel surface (`overview`, `kanban`, `projects`, `communications`) and wired it into office simulation modal/panel routing without reintroducing Convex dependencies.
- Removed the OfficeWorkspace overlay and restored panel-first navigation: top-left menu now opens standalone Team/Agent Session/Skills panels plus Settings, while in-scene actions open filtered panel contexts.
- UI layout is now aligned with operator expectations: menu at top-left, settings only as a menu option, and logs toggle anchored at bottom-right.
- Added employee-triggered Agent Memory Panel (`List`, `Search`, `Graph`) backed by parsed OpenClaw memory files (`MEMORY.md` + `memory/*.md`) through a new state-bridge endpoint, with visual QA spec/report artifacts under `docs/research/qa-testing/`.
