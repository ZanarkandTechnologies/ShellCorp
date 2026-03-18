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
| SC11 | Affiliate marketing MVP — full autonomous agent loop | in_progress |

## Notes

- SC11 is now formalized in `docs/specs/SC11-spec-affiliate-marketing-mvp.md` and defines the canonical PM/executor affiliate loop plus concrete measure/execute/distribute skill contracts.
- Legacy custom gateway/config runtime has been intentionally removed from active scope.
- The product direction is now Office UI + OpenClaw state adapters.
- Office workspace HUD now includes Team (communication handoff, kanban, business/KPI), Agent Session, Skills, and Settings tabs with shared app-store navigation and scene click routing.
- Settings access is restored through tab-aware modal controls, and agent/team click intents now open the matching workspace context instead of isolated dialogs.
- Parity migration in progress: chat/computer/manage-agent/training now route through dedicated Zanarkand-style modals with one-trigger-to-one-modal behavior.
- Added frontend-safe OpenClaw compatibility hooks for chat context/messages so UI parity ships before full backend feature parity.
- Restored broken office interactions: employee Chat now reliably opens ChatDialog above scene overlays, employee Tasks now routes to owner-focused Kanban, and team-cluster clicks open a dedicated Team Panel shell.
- Added OpenClaw-backed Team Panel surface (`overview`, `kanban`, `projects`, `memory`) and wired it into office simulation modal/panel routing without reintroducing legacy backend dependencies.
- Removed the OfficeWorkspace overlay and restored panel-first navigation: top-left menu now opens standalone Team/Agent Session/Skills panels plus Settings, while in-scene actions open filtered panel contexts.
- UI layout is now aligned with operator expectations: menu at top-left, settings only as a menu option, and logs toggle anchored at bottom-right.
- Added employee-triggered Agent Memory Panel (`List`, `Search`, `Graph`) backed by parsed OpenClaw memory files (`MEMORY.md` + `memory/*.md`) through a new state-bridge endpoint, with visual QA spec/report artifacts under `docs/research/qa-testing/`.
- Added phase-2 planning artifacts: founder-direction study (`ST01`), new specs (`SC06`-`SC10`), and expected visual QA ASCII baselines for Kanban Federation Panel and Agent Personalization Studio.
- Implemented SC06 baseline: federated task contracts (`provider`, `canonicalProvider`, `syncState`, `providerUrl`), project policy/profile structures, manual resync route, provider/canonical controls in Team Kanban, and Notion profile bootstrap UI for deterministic tool metadata.
- Reworked `SC12` onto the shared board/session model and finished the proposal purge: workflow now lives on normal board tasks with markdown task memory, `review` is a real board lane, `team proposal` is gone, and per-agent boards are filtered views over one canonical team board.
- Tightened the SC12 operator surface: the CEO Workbench task detail modal now uses a wider two-pane layout for readable task memory plus review actions, and the legacy office `Approvals` launcher has been removed so review flows only through `Human Review`.
- Added Notion plugin gateway methods for task list/create/update/sync and profile bootstrap (`notion-shell.tasks.*`, `notion-shell.profile.bootstrap`) so external provider logic stays plugin-first.
- Fixed office placement persistence regression: drag-release updates now resolve canonical office-object IDs across UI/persistence boundaries, re-sync local transforms after reload, and preserve last confirmed transform on save failure; added targeted tests and QA artifacts for placement persistence.
- Added two-phase Notion comment webhook flow: temporary FastAPI payload probe (`tools/notion-webhook-probe`) for verification/capture, then OpenClaw hooks mapping + transform hot-swap (`~/.openclaw/hooks/transforms/notion.ts`) with comments-first routing.

---

# Plan: Competitor-Repo Meta Workflow

**Status**: Proposed  
**Date Created**: 2026-03-09

## Mini-PRD Context

- **Goal:** Ship a daily competitor-intel workflow that reads `skills/competitor-feature-scout/watchlist.md`, scans last-day commits with `skills/competitor-feature-scout/SKILL.md`, and posts bounded adoption findings to the main agent bot via ShellCorp CLI.
- **User Outcome:** An operator or CEO agent can maintain a small repo watchlist and receive auditable, bounded follow-up work on the correct ShellCorp team board without manually re-checking the same commit ranges.
- **Constraints:** Follow `MEM-0152` (watchlist-driven, modular, cheap query before deeper analysis, bounded task creation), `MEM-0153` (CLI-and-skill-first workflow ownership), existing `team board task add` / Convex board flow, and current OpenClaw cron job patterns under `~/.openclaw/cron/jobs.json`.
- **Risks:** Repo fetch/auth ambiguity, duplicate tasks from repeated commit ranges, noisy heuristics, unclear boundary between deterministic CLI work and agent skill reasoning, and missing confidence/task-cap defaults.
- **Success Criteria:** One command can run the workflow end-to-end for a watchlist subset; cron can trigger it on cadence; state prevents reprocessing; digests/proposal history are persisted; only capped high-confidence `adapt` items create tasks.

## User Stories

- As an operator, I want `skills/competitor-feature-scout/watchlist.md` to remain the source of truth, so I can add or disable repos without code changes.
- As the CEO agent, I want deterministic scout output plus prior proposal history, so I only spend reasoning budget on meaningful repo changes.
- As a team owner, I want adoption work to land on the right board with dedupe and a per-run cap, so competitor monitoring does not spam the queue.

## Technical Implementation Plan

- **Scope (this slice only):** CLI-first competitor-intel orchestration plus cron bootstrap and persisted artifacts. No new UI surface. No webhook mode.
- **Skills to honor:** `competitor-feature-scout`, `shellcorp-team-cli`, `shellcorp-kanban-ops`, `status-self-reporter`. Delegation: Not needed.
- **Recommended architecture:** Keep fetch/filter/state/task-boundary logic deterministic in ShellCorp CLI, and keep the higher-cost proposal reasoning skill-driven at the CEO-agent layer. The implementation should materialize the skill contracts as explicit artifact and command boundaries instead of inventing a second workflow backend.
- **Touched Files / Interfaces / Systems:**
  - `skills/competitor-feature-scout/watchlist.md`
  - `cli/shellcorp-cli.ts`
  - new `cli/meta-commands/*` registrar and helpers
  - `cli/sidecar-store.ts` or adjacent helper for `~/.openclaw/competitor-intel/**`
  - shared board-task creation helper extracted from `cli/team-commands/team-board.ts` if needed
  - `cli/team-commands.test.ts` or new `cli/meta-commands.test.ts`
  - `docs/HISTORY.md`
  - `docs/MEMORY.md` if new durable invariants are introduced during implementation
- **Proposed command surface:**
  - `npm run shell -- meta competitor-repos scout --watchlist skills/competitor-feature-scout/watchlist.md [--repo owner/repo] [--dry-run] [--json]`
  - `npm run shell -- meta competitor-repos finalize --json-input '<proposal-batch-json>' [--apply]`
  - `npm run shell -- meta competitor-repos cron install --agent-id <ceoAgentId> [--cadence daily|hourly]`
  - Optional: `npm run shell -- meta competitor-repos history --json`
- **State / Artifact contract:**
  - Sidecar root: `~/.openclaw/competitor-intel/`
  - `repos/<owner>__<repo>.json`: branch, lastSeenSha, lastProcessedSha, lastRunAt, baseline summary, recent proposal ids / task ids
  - `digests/<timestamp>-<slug>.json|md`: scout output and ignored summary
  - `proposals/<proposalId>.json`: proposal decision, confidence, dedupe key, optional created task ids
- **Dependency Order:**
  1. Define watchlist parser, state schema, artifact paths, dedupe key format, and per-run cap behavior.
  2. Implement `scout` command: parse enabled repos, determine due entries, fetch new commit ranges, classify `ignore|candidate|priority`, persist digest + state.
  3. Implement `finalize` command: accept scout findings shaped by `competitor-feature-scout`, persist history, enforce cap rules, and create board tasks through existing board infrastructure.
  4. Implement `cron install`: upsert one CEO-oriented cron job that instructs the agent to run the scout command, use the two research skills, and call `finalize`.
  5. Add tests, docs, memory/history updates, and CLI bundle coverage.
- **Validation Strategy:**
  - Prefer isolated CLI tests with temporary `OPENCLAW_STATE_DIR`.
  - Stub repo inputs with fixture commit metadata rather than live network fetches.
  - Verify board-task creation through existing test seams and persisted proposal/task history.
- **Rollback / Safety Notes:**
  - Default new commands to dry-run/read-only unless `--apply` is set.
  - Never advance `lastProcessedSha` for candidate batches until proposal finalization is persisted.
  - Cap tasks per run globally and per repo.
  - Persist `ignored` and `watch` outputs for auditability.

## Acceptance Tests (Concrete, User-Observable)

- **Test Case 1: Watchlist-driven scout skips noise**
  - Given: `skills/competitor-feature-scout/watchlist.md` contains one enabled repo with product-facing paths and fixture commits that include docs-only churn plus one UI change.
  - When: `npm run shell -- meta competitor-repos scout --watchlist skills/competitor-feature-scout/watchlist.md --json`
  - Then: output contains one `candidate` batch, docs-only churn is listed under ignored summary, and `~/.openclaw/competitor-intel/repos/<repo>.json` records updated `lastSeenSha`.
  - Observable assertion: the JSON digest shows `classification: "candidate"` and heuristic reasons referencing the product-facing path.

- **Test Case 2: Finalize creates bounded deduplicated tasks**
  - Given: a proposal payload with two `adapt` proposals above threshold, one duplicate commit range already recorded, and a max-tasks-per-run cap of `1`.
  - When: `npm run shell -- meta competitor-repos finalize --json-input '<payload>' --apply`
  - Then: exactly one new board task is created on the watchlist entry’s `taskTeamId`, the duplicate is skipped, and proposal history records the created task id plus dedupe status.
  - Observable assertion: `team board task list --team-id <taskTeamId> --json` includes one new task whose detail references the proposal id / commit range.

- **Test Case 3: Cron install writes a stable CEO workflow job**
  - Given: a CEO agent id and empty `~/.openclaw/cron/jobs.json`
  - When: `npm run shell -- meta competitor-repos cron install --agent-id shellcorp-ceo`
  - Then: `jobs.json` contains one enabled competitor-meta job with the expected cadence and a payload message that explicitly tells the agent to run `competitor-feature-scout`.
  - Observable assertion: rerunning install updates the existing job instead of adding duplicates.

- **Test Case 4: Dry-run never mutates task state**
  - Given: candidate scout output and proposal payloads that would otherwise create tasks
  - When: the operator runs `scout --dry-run` and `finalize` without `--apply`
  - Then: digests are emitted for review but no board tasks are added and no `lastProcessedSha` is advanced past candidate ranges.
  - Observable assertion: board task list is unchanged while artifact files are present.

## Execution Todo List (Mandatory)

- [ ] Define and document the watchlist/state/artifact contracts for competitor intelligence.
- [ ] Add `meta competitor-repos scout` command with deterministic heuristics and persisted digest output.
- [ ] Add `meta competitor-repos finalize` command with proposal-history persistence, dedupe, threshold gating, and capped task creation.
- [ ] Add `meta competitor-repos cron install` command that writes a CEO workflow cron job.
- [ ] Reuse existing board-command infrastructure instead of shelling out to ad hoc queues.
- [ ] Add/extend CLI tests for scout, finalize, and cron install flows.
- [ ] Update `docs/HISTORY.md`.
- [ ] Promote any new durable invariant to `docs/MEMORY.md` and reference the resulting `MEM-####` in new logic files.
- [ ] Ensure new major logic files include the required header block.
- [ ] Run `npm run test:once -- <targeted tests>`
- [ ] Run `npm run typecheck`
- [ ] Run `npm run build`
- [ ] Run `npm run cli:bundle`
- [ ] Manually verify observable acceptance assertions with a temp `OPENCLAW_STATE_DIR`.

## Review / Test Criteria

- **Correctness:** watchlist entries map to the right repos, commit ranges, and team boards.
- **Completeness:** repeated runs remain idempotent; ignored/candidate/adapt/watch paths all persist audit trails.
- **Usability:** operator-facing commands stay CLI-first and `--json` friendly.
- **Observability:** digests, proposal history, cron job state, and created tasks are directly inspectable.
- **Risk Control:** no board spam, no silent cursor advancement, and safe dry-run behavior.

## Final Wow Gate

- [ ] The operator can point at `skills/competitor-feature-scout/watchlist.md` and explain the whole workflow without additional config files.
- [ ] The CEO agent prompt/job is explicit enough that the two research skills are actually usable in practice.
- [ ] The produced tasks are obviously ShellCorp-native adaptations, not competitor copy notes.

## Approval Handoff

Prepared to implement a CLI-first, cron-triggered competitor-repo workflow with deterministic scout/finalize boundaries, persisted sidecar state/artifacts, CEO-agent skill handoff, and bounded board-task creation. Yes/no to execute this plan.
