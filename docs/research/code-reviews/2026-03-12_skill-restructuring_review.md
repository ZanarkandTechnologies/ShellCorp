# Code Review: Skill Restructuring

## Summary
- Files reviewed: 8
- Critical issues: 0
- Important issues: 2
- Suggestions: 0

## Critical Issues (must fix)
- None.

## Important Issues (should fix)
### Issue 1: Workflow contract test does not validate the new board-task-based proposal container
- **File**: `skills/create-team/SKILL.md:61`
- **Confidence**: 89
- **Problem**: The workflow now states proposal state should be persisted on CEO board tasks (`taskType`, `approvalState`, linked session, task-memory notes), but the only `create-team` contract test still exercises `team proposal create/approve/execute` against `teamProposals` sidecar state and never verifies board-task metadata flow.
- **Fix**: Extend `skills/create-team/tests/team-proposal-lifecycle.md` with steps that run board-task commands (`team board task add/update/list --json`) and assert metadata markers via `stdoutIncludes` (for `taskType`, `approvalState`, `linkedSessionKey`, `createdTeamId/createdProjectId`), or adjust SKILL contract language to match what is actually executed and verified.

### Issue 2: CLI skill claims core create-team example is covered, but the documented command variant is not what the test runs
- **File**: `skills/shellcorp-team-cli/SKILL.md:30`
- **Confidence**: 84
- **Problem**: The documented create command includes `--with-cluster`, but `skills/shellcorp-team-cli/tests/create-business-team.md` omits that flag while claiming to prove the core example still works. This can miss regressions in the exact documented command path.
- **Fix**: Either include `--with-cluster` in the test case and assert expected side effects, or remove `--with-cluster` from the canonical example if it is intentionally optional and untested.

## Suggestions
- None.

## Strengths
- The workflow/tool split is explicit and bidirectional (`create-team` links to `shellcorp-team-cli` and vice versa).
- New markdown-based skill contract tests are executable and currently passing via `pnpm run test:skills`.

## Recommended Actions
1. Add board-task metadata assertions to the `create-team` lifecycle contract.
2. Align `shellcorp-team-cli` create example and test command flags.
3. Re-run `pnpm run test:skills` after updates.
4. Re-run review after fixes.
