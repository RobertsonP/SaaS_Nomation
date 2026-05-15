# Verdant Pro — UX correctness pass (Commits E-H)
Date: 2026-05-10
Branch: `redesign/v2`

## Context

User reports four concrete UX failures despite the design parity work already done:

1. **Elements tab is a mess.** Currently renders the test-builder card-list (correct for the builder sidebar, wrong for the project tab). The design wants a `<table>` here. Live Picker / Analyze / Clear-all buttons should NOT be on the project elements tab. "Clear all" should be a labelled "Clear elements" button. Clicking a row should open a preview drawer.
2. **TestsPage from sidebar has stray "Pick elements" button.** Wrong place. The Runs sidebar item also routes to TestsPage with a query-param — meaningless. Runs must be its own page showing actual executions log (test + suite).
3. **No in-process indicators for test/suite execution.** Analysis and Discovery have floating indicators; running a test or suite has only an inline spinner that disappears the moment the user navigates away. The Run button on Suite Results / Test Results doesn't even show running state.
4. **Results page is a mess.** Layout doesn't match `pages.jsx:229-285`: missing 4-tile stats row, missing Failure card / All-steps two-column body. Fonts and chrome are off.

## Audit summary (from parallel Explore agents)

### Elements tab
- `ProjectDetailsPage.tsx:893-930` passes `ElementLibraryPanel` for the 'elements' tab — same component as builder context.
- Buttons (`ElementLibraryPanel.tsx:468-529`) are gated by `onAnalyzePages` / `onClearElements` props which the project tab passes. Need explicit `mode` prop instead.
- `frontend/src/components/elements/` has NO `ElementInspectDrawer.tsx`. `onSelectElement` in ProjectDetailsPage:896 is a no-op logger.
- Design `projects.jsx:367-395`: 7-column table (Preview 90px / Label / Selector / Type / Page / Confidence / actions) with row click → `openModal('elementInspect', e)`.
- Design drawer `modals.jsx:193-226`: 560px right-slide drawer with screenshot, selector code, type/page/confidence row, "Used in" tests card.

### TestsPage + Runs
- `TestsPage.tsx:239-247` has the "Pick elements" button. State at line 70, modal mount at lines 433-450. Imports at lines 6 + 12.
- Sidebar Runs item (`VerdantSidebar.tsx:290-296`) navigates to `${projectRoot}/tests?view=runs`. The query param is ignored by TestsPage.
- App.tsx has no `/projects/:id/runs` route. No dedicated RunsPage component exists.
- `executionAPI` has `getResults(testId)`, `getStats()`, `getTrends()` — no cross-project executions endpoint. We can fetch all tests + suites for the project and merge their executions client-side (acceptable for v1).

### Floating indicators
| Op | Context | Indicator | Status |
|---|---|---|---|
| Page Analysis | yes | yes | done |
| Site Discovery | yes | yes | done |
| Test execution | hook only | inline spinner only | OK for short tests |
| Suite execution | none | none | **missing** |
| Live picker | n/a | n/a | not long-running |
| GitHub import | local state | none | acceptable for now |

The critical gap is suite execution: SuiteResultsPage's Run Suite button (line 174) has no disabled state, no spinner, and the user loses visibility on navigation. TestResultsPage's Run button (line 165) is missing a spinner too.

### Results page
- `pages.jsx:229-285` design:
  - `page-head`: status Pill + run ID mono dim + h1 (test name) + sub (suite + when + duration) + action buttons (Download log / Re-run / Open in builder)
  - 4 `StatTile` row: Status / Duration / Network / Console
  - 2-col `1fr 1fr` body: Failure card (screenshot 200px + code block + Re-pick / Suggest alt buttons) + All steps list
- Current `TestResultsPage.tsx`: 1fr/2fr split with execution history sidebar + `<TestExecutionReport>`. The selected-execution view goes through `TestExecutionReport` which is a different layout entirely.

## Implementation sequence — 4 commits

### Commit E — Elements tab table + drawer + remove Pick elements button
**Files:**
- `frontend/src/components/test-builder/ElementLibraryPanel.tsx`
  - Add `mode?: 'project-details' | 'test-builder'` prop (default `'test-builder'`)
  - In `mode === 'project-details'`: render a `<table className="table">` matching `projects.jsx:377-392`. Hide Analyze / Live Picker / Clear-all buttons. Hide bottom "Pick from page" strip.
  - In `mode === 'test-builder'`: keep current linear card list. Replace "Clear all" icon-btn with `<button className="btn btn-outline btn-sm">Clear elements</button>`.
  - Both modes call `onSelectElement(element)` on row/card click.
- `frontend/src/components/elements/ElementInspectDrawer.tsx` (NEW)
  - Right-slide drawer matching `modals.jsx:193-226`.
  - Props: `element: ProjectElement | null`, `onClose`, `usedInTests?: TestSummary[]`.
  - Sections: header with element label + close · screenshot/CSSPreview · selector code block · Type/Page/Confidence row · "Used in" card listing tests.
  - Footer: Close / Suggest alternates / Edit selector buttons.
- `frontend/src/pages/projects/ProjectDetailsPage.tsx`
  - Add `inspectElement` state.
  - Pass `mode="project-details"` and an `onSelectElement={setInspectElement}` to `ElementLibraryPanel` for the elements tab.
  - Render `<ElementInspectDrawer element={inspectElement} onClose={() => setInspectElement(null)} />`.
- `frontend/src/pages/tests/TestsPage.tsx`
  - Remove "Pick elements" button (lines 239-247), `showLivePicker` state (line 70), `<LiveElementPicker>` modal mount (lines 433-450), and `MousePointerClick` + `LiveElementPicker` imports.

### Commit F — Runs page (per-project executions log)
**Files:**
- `frontend/src/pages/tests/RunsPage.tsx` (NEW)
  - Fetches all project tests via `testsAPI.getByProject(projectId)` and all suites via `testSuitesAPI.getByProject(projectId)`.
  - For each test, fetch executions via `executionAPI.getResults(testId)`. For each suite, fetch via `testSuitesAPI.getExecutions(suiteId)`.
  - Merge all executions into a single sorted-by-startedAt array, tag each with `kind: 'test' | 'suite'`.
  - Render `<table className="table">` matching `projects.jsx:471-487`: columns Run (mono ID) / Target (test/suite name) / Type (kind) / Pass·Fail (mono moss/clay) / Status / Duration / When / By.
  - Empty state when no executions.
  - Click a row → navigate to `/tests/{testId}/results` or `/suites/{suiteId}/results` based on kind.
- `frontend/src/components/layout/VerdantSidebar.tsx`
  - Update Runs nav-item URL from `${projectRoot}/tests?view=runs` to `${projectRoot}/runs`.
- `frontend/src/App.tsx`
  - Add `<Route path="/projects/:projectId/runs" element={<RunsPage />} />` next to existing project routes.

### Commit G — Suite execution indicator + Run-button states
**Files:**
- `frontend/src/contexts/SuiteExecutionContext.tsx` (NEW) — mirror `AnalysisContext`:
  - State: `activeExecution: { suiteId, suiteName, executionId, startedAt, status: 'running'|'passed'|'failed', testsTotal, testsPassed, testsFailed, current: { testName, stepIndex } } | null`, `isMinimized`
  - WebSocket subscription to `/execution-progress` listening for `subscribe-to-suite` events.
  - Actions: `startTracking(suite, executionId)`, `minimize()`, `restore()`, `clear()`.
- `frontend/src/components/execution/SuiteExecutionFloatingIndicator.tsx` (NEW) — same pattern as `AnalysisFloatingIndicator`: surface card with accent stripe + Lucide spinner + tests-passed/total text + maximize/dismiss icon buttons. Visibility driven by `isMinimized && activeExecution`.
- `frontend/src/App.tsx` — wrap `<SuiteExecutionProvider>` and mount `<SuiteExecutionFloatingIndicator>` inside Router.
- `frontend/src/pages/tests/SuiteResultsPage.tsx` — line 174: derive `isRunning` from `executions[0]?.status === 'running'` or from suite execution context; disable + show `<Loader2 className="animate-spin">` when running.
- `frontend/src/pages/tests/TestResultsPage.tsx` — line 165 already has spinner via `useTestExecution`; verify it's wired.
- `frontend/src/pages/tests/SuiteDetailsPage.tsx` and `TestSuitesPage.tsx` — wire `startTracking()` after `testSuitesAPI.execute()` returns the executionId.

### Commit H — Test/Suite results page rebuild to match design
**Files:**
- `frontend/src/components/test-results/TestExecutionReport.tsx`
  - Restructure to match `pages.jsx:229-285`:
    - Drop the `.card` Steps section + Attachments card + summary tile row I built.
    - Replace with: 4-tile StatTile row (Status / Duration / Network — placeholder / Console — placeholder).
    - 2-column `1fr 1fr` grid: **Failure card** (left, only if status=failed) with screenshot 200px + code block of error + Re-pick element / Suggest alt selectors buttons; **All steps card** (right) with canonical step rows.
    - When status=passed, the failure card is replaced by an Attachments card (video + screenshots gallery).
- `frontend/src/components/test-results/SuiteExecutionReport.tsx`
  - Same shape: page-head treatment is in the page; the report renders the body as a 2-col grid with summary + per-test list.
- `frontend/src/pages/tests/TestResultsPage.tsx`
  - The page-head should match design: status Pill + run ID mono dim + h1 (test name) + sub (started X · ran for Y) + Download log / Re-run / Open in builder buttons.
  - The execution history sidebar can stay but moves below or to a smaller width — keep functional value of switching runs.
- `frontend/src/pages/tests/SuiteResultsPage.tsx` — same treatment.
- Need a `StatTile` component if not already — check `frontend/src/components/ui/StatTile.tsx`.

## Verification per commit

1. `cd frontend && npx tsc --noEmit` exit 0.
2. Open the affected route in dev server, hard-refresh (Ctrl+F5).
3. Side-by-side with prototype.
4. Smoke flow:
   - E: project Elements tab → table renders, click row opens drawer; TestsPage from sidebar → no Pick elements button.
   - F: click Runs in sidebar → see merged test+suite executions table.
   - G: run a suite → close modal/navigate → floating indicator visible → click maximize → return to suite results.
   - H: open a test results page → see 4-tile row + Failure/All-steps grid; pass case shows Attachments instead of Failure.
5. Light + dark theme on every changed surface.
6. Commit with `redesign(parity): <commit-letter>: <summary>`.

## What this plan does NOT do

- No backend changes. RunsPage uses existing per-test / per-suite endpoints and merges client-side.
- No new icons in lucide. Reuse existing.
- No changes to `lib/api.ts`, contexts other than the new SuiteExecutionContext.
- No changes to layout shell, sidebar nav (other than Runs URL), or topbar.
