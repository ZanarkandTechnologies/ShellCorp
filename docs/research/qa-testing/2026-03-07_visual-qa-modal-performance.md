## Expected UI Spec
- Screen intent: opening a configured office object should show runtime modal chrome quickly, even if the embedded site is slow or blocked.
- Components: centered modal, title/description header, object summary card, `Open In New Tab` action, iframe viewer or blocked-embed fallback.
- UX goal: the user should see the modal immediately and understand the site can still be launched externally.
- Layout assertions:
  - modal region should be centered and occupy most of the viewport width without clipping.
  - header should remain pinned above the content body.
  - the summary card and external-open CTA should appear above the iframe region.

## Observed Snapshot Report
- Evidence was captured against `http://127.0.0.1:4175/office` using the live dev store hook to open the real runtime modal for the configured globe object.
- Observed target: `World Monitor`.
- Instrumented timing from app console:
  - `office-object-modal-ready`: `621ms`
  - `office-object-iframe-load`: `1007ms`
- DOM snapshot from `test-results/object-modal-perf.json` confirms:
  - `dialogCount: 1`
  - modal title: `World Monitor`
  - modal description is present
  - `Open In New Tab` button is present
- The source site still blocks iframe embedding via CSP, which is expected and surfaced in the console artifact.

## Diff Report + Verdict
- Verdict: `PASS`
- Top 3 visual diffs:
  - Modal chrome appears with the expected centered dialog layout instead of the previous sheet-style interaction.
  - The summary card and `Open In New Tab` CTA remain visible before iframe success/failure settles.
  - No builder radial UI is involved in the runtime modal path.
- Top 3 behavior diffs:
  - Runtime modal first paint is now driven by resolved store payload instead of office-object context lookup.
  - Runtime open path logs show the modal shell becoming ready before iframe load completes.
  - Stale selection state is cleared after modal open, preventing old context-menu selection from lingering behind the dialog.
- Severity: `minor`
- Fix directives:
  - No immediate UI fix required.
  - Continue monitoring the provider stabilization path under larger office datasets because current evidence was captured on the active local office state only.
- Artifacts:
  - `test-results/object-modal-before.png`
  - `test-results/object-modal-after.png`
  - `test-results/object-modal-perf.json`

## Fix Plan
- Keep the new hot-path resolved modal payload and no-op store guards.
- If larger offices still hitch, profile `OfficeDataProvider` signature work and consider splitting live status from structural office data.
- If reopening panel state needs to preserve hidden panel memory later, add explicit state persistence after confirming the new conditional TeamPanel mount strategy is acceptable.
