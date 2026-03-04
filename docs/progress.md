# Shell Company MVP Progress

**Status**: in_progress  
**Date**: 2026-02-26

## Active Slice

UI-first OpenClaw mapping pivot:

| ID | Title | Status |
| --- | --- | --- |
| SC01 | OpenClaw state mapping contracts | completed |
| SC02 | In-repo Notion OpenClaw plugin scaffold | completed |
| SC03 | Memory + skills UI upgrade baseline | completed |
| SC04 | Chat bridge and session timeline baseline | completed |
| SC05 | Wire live OpenClaw endpoints on VPS | in_progress |
| SC06 | Kanban federation and sync policy | in_progress |
| SC07 | Ticket-session lifecycle contract | planned |
| SC08 | Provider context indexing and generated skill catalog | planned |
| SC09 | Agent personalization and mesh/image wrapper integration | planned |
| SC10 | Heartbeat-driven autonomy loop governance | planned |

## Notes

- Legacy custom gateway/config runtime has been intentionally removed from active scope.
- The product direction is now Office UI + OpenClaw state adapters.
- Office workspace HUD now includes Team (communication handoff, kanban, business/KPI), Agent Session, Skills, and Settings tabs with shared app-store navigation and scene click routing.
- Settings access is restored through tab-aware modal controls, and agent/team click intents now open the matching workspace context instead of isolated dialogs.
- Parity migration in progress: chat/computer/manage-agent/training now route through dedicated Zanarkand-style modals with one-trigger-to-one-modal behavior.
- Added frontend-safe OpenClaw compatibility hooks for chat context/messages so UI parity ships before full backend feature parity.
- Restored broken office interactions: employee Chat now reliably opens ChatDialog above scene overlays, employee Tasks now routes to owner-focused Kanban, and team-cluster clicks open a dedicated Team Panel shell.
- Added OpenClaw-backed Team Panel surface (`overview`, `kanban`, `projects`, `communications`) and wired it into office simulation modal/panel routing without reintroducing legacy backend dependencies.
- Removed the OfficeWorkspace overlay and restored panel-first navigation: top-left menu now opens standalone Team/Agent Session/Skills panels plus Settings, while in-scene actions open filtered panel contexts.
- UI layout is now aligned with operator expectations: menu at top-left, settings only as a menu option, and logs toggle anchored at bottom-right.
- Added employee-triggered Agent Memory Panel (`List`, `Search`, `Graph`) backed by parsed OpenClaw memory files (`MEMORY.md` + `memory/*.md`) through a new state-bridge endpoint, with visual QA spec/report artifacts under `docs/research/qa-testing/`.
- Added phase-2 planning artifacts: founder-direction study (`ST01`), new specs (`SC06`-`SC10`), and expected visual QA ASCII baselines for Kanban Federation Panel and Agent Personalization Studio.
- Implemented SC06 baseline: federated task contracts (`provider`, `canonicalProvider`, `syncState`, `providerUrl`), project policy/profile structures, manual resync route, provider/canonical controls in Team Kanban, and Notion profile bootstrap UI for deterministic tool metadata.
- Added Notion plugin gateway methods for task list/create/update/sync and profile bootstrap (`notion-shell.tasks.*`, `notion-shell.profile.bootstrap`) so external provider logic stays plugin-first.
- Fixed office placement persistence regression: drag-release updates now resolve canonical office-object IDs across UI/persistence boundaries, re-sync local transforms after reload, and preserve last confirmed transform on save failure; added targeted tests and QA artifacts for placement persistence.
- Added two-phase Notion comment webhook flow: temporary FastAPI payload probe (`tools/notion-webhook-probe`) for verification/capture, then OpenClaw hooks mapping + transform hot-swap (`~/.openclaw/hooks/transforms/notion.ts`) with comments-first routing.
