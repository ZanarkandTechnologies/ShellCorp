# Visual QA Report: Office Loader

## Expected UI Spec
- Screen intent: the office bootstrap overlay should read as a centered branded loading state while the 3D scene finishes initialization.
- Components: centered loader badge, brand/title/detail copy, progress rail with active stage, and a stage-card region below the rail.
- UX goal: users should first notice the center badge and title, then understand active progress immediately, then scan each bootstrap stage without any text jutting outside the layout.
- Layout map: one centered modal-like shell inside the viewport; hero badge at top-center; title/copy under it; progress card below; stage cards aligned in a centered grid beneath.
- Primary CTA: none; this is informational only.
- Visual hierarchy: 1) badge plus `Loading office`, 2) progress rail and percentage, 3) stage labels/details.
- Spacing rhythm: balanced vertical spacing between hero, copy, progress, and cards; no compressed text lines.
- Typography: large centered heading, restrained uppercase brand label, wrapped detail copy with readable line-height, and stage details allowed to span multiple lines.
- Color and contrast: shared `background/card/border/foreground/muted/primary` tokens only; active spinner and progress rail use primary emphasis.
- Elevation: shell and cards should read above the dimmed scene backdrop with one coherent glass/HUD treatment.
- Alignment: the entire overlay is centered; stage-card copy is centered within each card rather than left-truncated.
- Responsiveness: stage cards may collapse to one column on narrow widths, but the shell stays centered and text remains wrapped.
- Layout assertions:
  - `loaderShell`: expected bbox pct `{ x: [18, 82], y: [10, 90], w: [38, 68], h: [52, 82] }`, tolerance `4`
  - `heroBadge`: expected bbox pct `{ x: [44, 56], y: [10, 28], w: [6, 14], h: [9, 18] }`, tolerance `3`
  - `stageGrid`: expected bbox pct `{ x: [18, 82], y: [52, 90], w: [38, 68], h: [18, 40] }`, tolerance `4`

## Observed Snapshot Report
- Code evidence:
  - [`ui/src/components/office-loader.tsx`](/home/kenjipcx/Zanarkand/ShellCorp/ui/src/components/office-loader.tsx) now centers a `max-w-4xl` shell with centered hero, copy, and a `md:grid-cols-3` stage-card region.
  - [`ui/src/components/office-loader.tsx`](/home/kenjipcx/Zanarkand/ShellCorp/ui/src/components/office-loader.tsx) removes the prior `truncate` detail treatment and allows stage detail copy to wrap with `leading-6`.
  - [`ui/src/components/office-loader.test.ts`](/home/kenjipcx/Zanarkand/ShellCorp/ui/src/components/office-loader.test.ts) verifies the loader renders the stage grid, active progress label, and no truncation marker.
- Runtime QA attempt:
  - Local Vite app was started successfully on `http://127.0.0.1:4174/`.
  - A Playwright screenshot attempt failed inside the sandbox before browser startup with `sandbox_host_linux.cc:41` / `shutdown: Operation not permitted`.
- Available runtime artifacts:
  - No screenshot was produced because headless Chromium could not run in this sandbox.
  - No DOM snapshot was produced beyond the failed browser-launch attempt.

## Diff Report + Verdict
- Verdict: `FAIL`
- Top 3 visual diffs:
  - Centering and card geometry are strongly implied by class structure but not measured from a live screenshot.
  - The exact visual balance of the new hero shell against the dimmed scene backdrop is unverified at runtime.
  - Responsive collapse from three cards to one-column stacking is unverified in a real viewport.
- Top 3 behavior diffs:
  - Loader visibility timing on first paint is not browser-verified.
  - Transition from loading overlay to live scene is not browser-verified.
  - Font rendering and real line wrapping are not browser-verified.
- Severity: `major`
- Fix directives:
  - Re-run this QA on a machine where Playwright/Chromium can launch and capture a full screenshot during bootstrap.
  - Verify desktop and narrow-width geometry against the assertions above.
  - Confirm the active stage copy still reads cleanly when real bootstrap timing changes quickly.
- Artifacts:
  - Report: [`docs/research/qa-testing/2026-03-13_office-loader-visual-qa.md`](/home/kenjipcx/Zanarkand/ShellCorp/docs/research/qa-testing/2026-03-13_office-loader-visual-qa.md)
  - Browser launch failure was observed during an attempted Playwright run against the local Vite server; no screenshot artifact was emitted.

## Fix Plan
- Keep the centered shell and wrapped stage-card structure as the implementation baseline.
- When browser execution is available, capture one bootstrap screenshot at desktop width and one at a narrow width.
- If runtime visuals show the shell too wide or stage cards too tall, trim `max-w-4xl` or reduce card padding rather than reintroducing truncation.
