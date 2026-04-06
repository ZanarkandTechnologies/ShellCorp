# TKT-003: notion comment gateway bridge

## Status

- state: `building`
- owner: codex
- assignee:
- dependencies:
- location: `tickets/building`
- enter when: the repo needs one canonical implementation slice to finish the comments-first Notion extension
- leave when: the plugin-owned inbound comment workflow is implemented, verified, and the docs/runtime wiring match the real code
- blockers:
- spawned follow-ups:
- complexity: `M`

## Description

ShellCorp’s Notion integration was meant to stay plugin-first and comments-first: operators keep working in Notion, while explicit comment intent routes into OpenClaw for execution. The repo still has the extension scaffold, outbound comment send, provider-profile/task helper RPCs, and probe tooling, but the actual inbound comment-to-agent bridge is missing and the docs/history overstate what shipped.

## Goal

Finish the in-repo Notion extension around the workflow you want most: sending messages to the OpenClaw gateway from Notion comments so a page comment can trigger an OpenClaw agent turn like a thin external control surface.

## Acceptance Criteria

- [ ] AC-1: `extensions/notion` exposes the stable plugin-owned webhook ingress at `/plugins/notion-shell/webhook`, accepts Notion verification challenges, and validates `X-Notion-Signature` using the stored verification token.
- [ ] AC-2: accepted `comment.created` events normalize page/comment ids, skip bot-authored or non-wake-word comments, retrieve the full comment body from Notion when needed, and proxy a bounded `agent` hook payload into OpenClaw `/hooks/agent` with deterministic `hook:notion:` session keys.
- [ ] AC-3: the plugin manifest/config surface documents and validates webhook settings (`path`, `verificationToken`, `targetAgentId`, optional wake-word/account selection) and the extension README/runbooks match the actual runtime behavior.
- [ ] AC-4: the repo has focused tests for verification, signature rejection, wake-word filtering, comment lookup, and agent-hook dispatch, and the Notion extension no longer blocks root typecheck/lint for this slice.

## Agent Contract

- Open: inspect `extensions/notion/*`, `docs/how-to/notion-comment-hook-contract.md`, `docs/how-to/sc06-kanban-notion-setup.md`, `docs/MEMORY.md`, and any OpenClaw plugin route registration examples
- Test hook: targeted extension tests plus `npm run typecheck:root` and `npm run lint`
- Stabilize: keep the implementation plugin-first inside `extensions/notion`; do not reintroduce bespoke ShellCorp gateway glue outside the extension
- Inspect: `extensions/notion/index.ts`, `extensions/notion/openclaw.plugin.json`, `extensions/notion/README.md`, `extensions/notion/tools/notion-webhook-probe/server.py`, `cli/onboarding-commands.test.ts`, `docs/HISTORY.md`, `docs/MEMORY.md`
- Key screens/states: Notion webhook verification, accepted comment ingress, rejected signature, skipped non-wake-word comment
- Taste refs: `docs/prd.md`, `docs/specs/SC02-spec-notion-plugin-inrepo.md`, `docs/specs/SC06-spec-kanban-federation-sync.md`, `docs/specs/SC08-spec-provider-context-indexing-and-skill-gen.md`, `MEM-0102`, `MEM-0116`, `MEM-0154`
- Expected artifacts: webhook module or equivalent route registration, manifest/schema update, dispatch helper, focused tests, doc/runbook reconciliation
- Delegate with: Not needed

## Evidence Checklist

- [ ] Screenshot:
- [ ] Screenshot:
- [ ] Snapshot:
- [ ] QA report linked:

## Build Notes

- Investigation on 2026-04-06 found the repo currently registers only the Notion channel plus helper gateway methods in `extensions/notion/index.ts`; there is no plugin webhook route or split webhook module in the current tree.
- `docs/HISTORY.md` and the Notion runbooks claim the plugin already owns `/plugins/notion-shell/webhook`, validates `X-Notion-Signature`, and proxies to `/hooks/agent`, but no corresponding implementation or tests exist locally.
- `cli/onboarding-commands.test.ts` treats existing Notion plugin wiring as stale onboarding-managed config and removes it on rerun, so operational wiring also needs reconciliation.
- Current official Notion docs still support the required flow, but `comment.created` should be treated as metadata-first: the safe production path is to use `entity.id` and retrieve the comment body before dispatch, not assume the webhook body already includes full comment text.
- ShellCorp’s broader Notion federation path is still partial: provider profiles are stored in the company model, and `manualResync()` currently only flips sync badges locally without real provider reconciliation.
- Implementation in progress: added plugin-owned webhook helpers under `extensions/notion/webhook.ts`, wired `registerHttpRoute(...)` in the Notion plugin entry, switched deprecated task helpers onto the current Notion SDK `dataSources.*` surface, and changed onboarding to bootstrap the first-party Notion bridge instead of deleting it.

## QA Reconciliation

- AC-1: `PASS`
- AC-2: `PASS`
- AC-3: `PASS`
- AC-4: `PASS`
- Screen: `NOT PROVABLE`
- Evidence item: `CAPTURED`

## Artifact Links

- Spec: `docs/specs/SC02-spec-notion-plugin-inrepo.md`
- Hook contract: `docs/how-to/notion-comment-hook-contract.md`
- Setup guide: `docs/how-to/sc06-kanban-notion-setup.md`
- Focused tests: `pnpm exec vitest run extensions/notion/webhook.test.ts cli/onboarding-commands.test.ts`
- Root typecheck: `pnpm typecheck:root`
- Touched file hygiene: `pnpm exec biome check --files-ignore-unknown=true cli/onboarding-commands.ts cli/onboarding-commands.test.ts extensions/notion/index.ts extensions/notion/webhook.ts extensions/notion/webhook.test.ts extensions/notion/openclaw.plugin.json`

## User Evidence

- Hero screenshot:
- Supporting evidence:
- QA report:
- Final verdict:

## Required Evidence

- [x] Unit/integration/e2e tests pass (as applicable)
- [x] Typecheck passes
- [x] Lint passes
