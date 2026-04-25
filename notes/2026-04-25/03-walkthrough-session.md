# Browser Walkthrough Session
Date: 2026-04-25
Branch: fixes_live_picker
Method: User drives the discussion, Claude drives Chromium via Playwright MCP, both walk through the live app on `localhost:3001`.

## Status
**In progress.** User is actively pointing out issues. 8 recorded so far. No code changes yet — pure issue capture, fix plan still to be written.

## Issues Recorded
Source of truth: `notes/2026-04-25/02-walkthrough-issues.md`. Summary:

| # | Severity | Title | Anger flag |
|---|----------|-------|-----------|
| 1 | major | Element library sidebar hides pages until pagination | — |
| 2 | major | Footer/nav elements duplicated once per page (decision: B = region-based group into "Shared elements") | — |
| 3 | minor→major | Main app sidebar cannot be collapsed | — |
| 4 | minor | Test row action buttons visually misaligned, 🎬 unlabeled | — |
| 5 | major | One Run button + headed/headless picker; drop 🎬 | **YES** ("makes me angry") |
| 6 | minor→major | Test Builder layout messy; Save floats at bottom; "unethical" | **YES** |
| 6b | — | Same paginated-page-list bug confirmed in Test Builder (fixed by #1) | — |
| 7 | minor | Remove Templates button + modal entirely (replaced by future AI test gen) | — |
| 8 | **blocker** | Table cells highlight but cell click is dead-end — no popover, no step added | "I cannot" |

## What Was Walked Through
- Login as `r1@test.com` (cached session, auto-redirected to dashboard).
- Project "tts" (11 URLs, 295 elements, 1 test).
- Project URLs tab — not yet inspected (next candidate).
- Project Elements tab — issues #1, #2 surfaced via Load More clicks (50 → 100 → 250 of 295).
- Tests list page — issues #3, #4, #5 surfaced.
- Test Builder edit page (test "test", 1 unsaved CLICK step) — issues #6, #6b, #7, #8 surfaced.

## Decisions Locked
- **Issue #2** strategy: B (region-based grouping using existing "in footer" / "in top navigation" labels).
- **Issue #5** path: reuse existing Test Builder Normal Mode (`startNormalExecution`) for the headed branch — NOT the Live Picker session.
- **Issue #7**: TemplateModal.tsx (147 lines, frontend-only) gets deleted; backend "template" hits are unrelated and stay.

## Open Decisions (to resolve before plan-write)
- **#1**: do we fetch a separate "page summary" endpoint with real DB counts, or denormalize counts into the project shape?
- **#2**: storage-layer dedup vs render-layer dedup. User leaning render-layer (Phase 1).
- **#3**: hard-collapse-to-zero vs collapse-to-icon-rail.
- **#5**: `/run-live` endpoint — keep, deprecate, or repurpose for the new headed path.
- **#6**: where does Save Test live in the new layout? (header strip vs sticky bottom of right panel).
- **#8**: must verify the 2026-02-18 unfinished change to `TableExplorer.handleCellClick` actually landed before designing the fix.

## What's Still to Walk Through (user-driven)
Whatever the user wants next. Likely candidates the user hasn't shown yet: Site Map tab, URLs tab (test the new rename UI from this morning's Fix 2!), Authentication tab, AI Generate Tests button, Live Picker (just rebuilt this morning's Fix 3 — should test it before declaring done), Live execution modal, View Results page.

## Critical Note for Next Agent
When the walkthrough is finished, the user wants me to write a fix plan from the issues file. **Do not start implementing** without writing the plan first and getting approval. Same workflow we used this morning.

## Files Created Today
- `notes/2026-04-25/01-four-fixes-implementation.md` — morning sprint (committed, branch `fixes_live_picker` ahead of master by 5 commits).
- `notes/2026-04-25/02-walkthrough-issues.md` — issues being recorded (this walkthrough).
- `notes/2026-04-25/03-walkthrough-session.md` — this session summary.
- `element-library-tab.png`, `tests-page.png`, `test-buttons-misaligned.png`, `test-builder-edit.png`, `table-element.png`, `table-explore.png`, `table-cell-after-click.png`, `left-sidebar.png` — screenshots in repo root (move to a screenshots/ folder before committing if we keep them).
