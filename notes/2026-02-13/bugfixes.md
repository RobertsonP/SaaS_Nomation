Updated plan

&nbsp; ⎿  Added 258 lines, removed 259 lines

&nbsp;       1 -# Sprint: Element Library \& Analyzer Improvements

&nbsp;       2 -

&nbsp;       3 -## Context

&nbsp;       4 -

&nbsp;       5 -User tested the product after the last sprint (7 fixes + refactoring) and found 9 issues across the

&nbsp;         -element library UI, analyzer performance, progress UX, hidden element discovery, and localhost

&nbsp;         -discovery. This plan addresses all 9 issues surgically — each phase is independent so nothing breaks

&nbsp;         -if we ship incrementally.

&nbsp;       6 -

&nbsp;       7 ----

&nbsp;       8 -

&nbsp;       9 -## Phase 0: Session Setup (always first)

&nbsp;      10 -

&nbsp;      11 -Before any code work:

&nbsp;      12 -

&nbsp;      13 -1. \*\*Create daily notes directory:\*\* `/notes/2026-02-13/`

&nbsp;      14 -2. \*\*Create session plan note:\*\* `/notes/2026-02-13/01-element-library-analyzer-sprint.md`

&nbsp;      15 -   - Include: date, time (GMT+4), plan summary, step checklist

&nbsp;      16 -   - Format per CLAUDE.local.md workflow rules

&nbsp;      17 -3. \*\*Create active work file:\*\* `/notes/2026-02-13/active-work.md`

&nbsp;      18 -   - Current task, current step, what's done, what's remaining

&nbsp;      19 -4. \*\*Update as work progresses\*\* — mark steps `\[+]` when complete

&nbsp;      20 -5. \*\*Write handoff note\*\* at session end: `/notes/2026-02-13/handoff.md`

&nbsp;      21 -

&nbsp;      22 ----

&nbsp;      23 -

&nbsp;      24 -## Phase 1: Element Card UX Cleanup

&nbsp;      25 -\*\*Issues: #1 (clickable cards), #2 (Clear button), #3 (card info overload), #7 (professional look)\*\*

&nbsp;      26 -

&nbsp;      27 -### What changes

&nbsp;      28 -

&nbsp;      29 -\*\*ElementPreviewCard.tsx\*\* — full redesign:

&nbsp;      30 -- Make entire card clickable (`onClick` → `onSelectElement`). Add `role="button"`, `tabIndex={0}`,

&nbsp;         -keyboard support

&nbsp;      31 -- Hover: `hover:border-blue-400 hover:shadow-md cursor-pointer active:scale-\[0.98]`

&nbsp;      32 -- Remove: "Use in Test" button, quality percentage badge, question mark icon, `showFullSelector`

&nbsp;         -toggle

&nbsp;      33 -- Keep: type badge, discovery state badge, description (line-clamp-2), CSS preview (max-h-20),

&nbsp;         -selector (truncated, with copy icon using `stopPropagation`), source page URL path

&nbsp;      34 -- Layout order: badges → description → CSS preview → selector + copy → source URL

&nbsp;      35 -

&nbsp;      36 -\*\*TablePreviewCard.tsx\*\*:

&nbsp;      37 -- Make entire card clickable (same pattern)

&nbsp;      38 -- Remove "Use in Test" button from header

&nbsp;      39 -- Add `stopPropagation` on all internal clickables (row copy, selector copy, expand toggle)

&nbsp;      40 -

&nbsp;      41 -\*\*ElementLibraryPanel.tsx\*\*:

&nbsp;      42 -- Remove quality filter chips entirely (delete `QUALITY\_FILTERS`, `qualityFilter` state, quality

&nbsp;         -filtering logic)

&nbsp;      43 -- Fix Clear button: add `border border-red-300 dark:border-red-600` to match sibling button shapes

&nbsp;      44 -

&nbsp;      45 -### Files

&nbsp;      46 -- `frontend/src/components/elements/ElementPreviewCard.tsx`

&nbsp;      47 -- `frontend/src/components/elements/TablePreviewCard.tsx`

&nbsp;      48 -- `frontend/src/components/test-builder/ElementLibraryPanel.tsx`

&nbsp;      49 -- `frontend/src/components/elements/CSSPreviewRenderer.tsx` (remove dead quality badge code)

&nbsp;      50 -

&nbsp;      51 ----

&nbsp;      52 -

&nbsp;      53 -## Phase 2: Table Usability

&nbsp;      54 -\*\*Issue: #4 (table must be usable for test verification)\*\*

&nbsp;      55 -

&nbsp;      56 -### Backend: Expand table data extraction

&nbsp;      57 -

&nbsp;      58 -\*\*element-detection.service.ts\*\* (lines 90-147, inside `page.evaluate`):

&nbsp;      59 -- Increase sample rows from 3 → 50

&nbsp;      60 -- Generate `rowSelectors\[]`: `{tableSelector} tbody tr:nth-child(N)` for each row

&nbsp;      61 -- Generate `columnSelectors\[]`: `{tableSelector} thead th:nth-child(N)` for each header

&nbsp;      62 -- Generate `cellSelectors\[]\[]`: 2D array, `{tableSelector} tbody tr:nth-child(R) td:nth-child(C)` per

&nbsp;         - cell

&nbsp;      63 -- Populate `headerColumnMap`: `{ "Name": 0, "Email": 1, ... }`

&nbsp;      64 -- Add `hasHeaders` and `hasTbody` flags for correct selector patterns

&nbsp;      65 -- Handle tables without `thead` or `tbody` gracefully

&nbsp;      66 -

&nbsp;      67 -\*\*interfaces/element.interface.ts\*\* + \*\*frontend types\*\* — add new fields to `tableData` type.

&nbsp;      68 -

&nbsp;      69 -### Frontend: Table Explorer + Cell Selector

&nbsp;      70 -

&nbsp;      71 -\*\*New: TableExplorer.tsx\*\* — inline expandable panel below the table card:

&nbsp;      72 -- Full table with horizontal scroll, sticky header + row numbers

&nbsp;      73 -- Click any column header → copy column selector

&nbsp;      74 -- Click any row number → copy row selector

&nbsp;      75 -- Click any cell → show popover with:

&nbsp;      76 -  - Cell selector (copy button)

&nbsp;      77 -  - Ready-made assertion: `await expect(page.locator('...')).toHaveText('...');`

&nbsp;      78 -  - Contains + visibility assertion variants

&nbsp;      79 -

&nbsp;      80 -\*\*New: assertion-templates.ts\*\* — utility generating Playwright assertion code for cells/rows.

&nbsp;      81 -

&nbsp;      82 -\*\*TablePreviewCard.tsx\*\* — add "Explore" button that toggles the TableExplorer inline.

&nbsp;      83 -

&nbsp;      84 -### Files

&nbsp;      85 -- `backend/src/ai/element-detection.service.ts`

&nbsp;      86 -- `backend/src/ai/interfaces/element.interface.ts`

&nbsp;      87 -- `frontend/src/types/element.types.ts`

&nbsp;      88 -- `frontend/src/components/elements/TablePreviewCard.tsx`

&nbsp;      89 -- `frontend/src/components/elements/TableExplorer.tsx` (new)

&nbsp;      90 -- `frontend/src/components/elements/CellSelectorPopover.tsx` (new)

&nbsp;      91 -- `frontend/src/utils/assertion-templates.ts` (new)

&nbsp;      92 -

&nbsp;      93 ----

&nbsp;      94 -

&nbsp;      95 -## Phase 3: Analyzer Speed

&nbsp;      96 -\*\*Issue: #5 (analyzer too slow)\*\*

&nbsp;      97 -

&nbsp;      98 -### What's actually slow (it's NOT AI)

&nbsp;      99 -AI/Ollama is essentially disabled — it only runs if Ollama is available (usually isn't). The real

&nbsp;         -time-eaters:

&nbsp;     100 -

&nbsp;     101 -1. \*\*Element screenshots\*\* — For each element found (could be 200+), the system opens a browser,

&nbsp;         -finds the element, and takes a photo. Each photo = 0.2-0.5s. With 200 elements = \*\*40-100 seconds

&nbsp;         -wasted on photos nobody needs.\*\*

&nbsp;     102 -2. \*\*Second browser pass\*\* — After extracting elements once, the system does a SECOND full scan of

&nbsp;         -the page to regenerate advanced selectors. This is redundant.

&nbsp;     103 -3. \*\*Interactive discovery\*\* — Clicks up to 10 buttons (modals, dropdowns) with 800ms waits. Adds 8+

&nbsp;         -seconds.

&nbsp;     104 -

&nbsp;     105 -### What we already have that works

&nbsp;     106 -The \*\*CSS preview\*\* already recreates how elements look using their actual colors, fonts, borders,

&nbsp;         -and sizes. Users see a visual preview without any screenshot. This is extracted during the main scan

&nbsp;         -and costs almost nothing.

&nbsp;     107 -

&nbsp;     108 -### Solution: Remove screenshots, keep CSS preview, skip redundant passes

&nbsp;     109 -

&nbsp;     110 -\*\*Remove element screenshots from analysis entirely:\*\*

&nbsp;     111 -- Don't call `captureElementScreenshotFromPage()` during `extractAllPageElements()`

&nbsp;     112 -- CSS preview handles visual representation

&nbsp;     113 -- Keep `ScreenshotService` alive for on-demand use (individual element screenshot if user really

&nbsp;         -wants one)

&nbsp;     114 -

&nbsp;     115 -\*\*Skip the second browser pass:\*\*

&nbsp;     116 -- The first `page.evaluate()` already extracts selectors + CSS properties

&nbsp;     117 -- Skip the second pass that regenerates "advanced selectors" — use what we got from the first pass

&nbsp;     118 -

&nbsp;     119 -\*\*Keep interactive discovery as optional (Phase 5 handles improving it):\*\*

&nbsp;     120 -- Don't run it during initial scan

&nbsp;     121 -- Users trigger it separately when they want deeper element discovery

&nbsp;     122 -

&nbsp;     123 -\*\*Result:\*\* Analysis per page drops from ~30-60s to ~5-10s. Users see elements almost immediately.

&nbsp;     124 -

&nbsp;     125 -### Files

&nbsp;     126 -- `backend/src/ai/element-detection.service.ts` — remove screenshot calls during extraction, skip

&nbsp;         -second pass

&nbsp;     127 -- `backend/src/ai/element-analyzer.service.ts` — always pass `skipScreenshots: true`, skip

&nbsp;         -interactive discovery in default mode

&nbsp;     128 -- `frontend/src/components/elements/CSSPreviewRenderer.tsx` — improve CSS preview quality where

&nbsp;         -needed (fallback for elements without CSS data)

&nbsp;     129 -

&nbsp;     130 ----

&nbsp;     131 -

&nbsp;     132 -## Phase 4: Analysis Progress UX

&nbsp;     133 -\*\*Issue: #6 (progress popups poor UX, missing data, inconsistent)\*\*

&nbsp;     134 -

&nbsp;     135 -### Problems found

&nbsp;     136 -- Two independent WebSocket connections (modal has its own, floating indicator gets state from

&nbsp;         -`useProjectWebSocket`)

&nbsp;     137 -- Progress log shows raw technical events like "ELEMENT\_EXTRACTION"

&nbsp;     138 -- Missing data between modal and floating indicator

&nbsp;     139 -- Looks like a debug console, not a user-facing progress view

&nbsp;     140 -

&nbsp;     141 -### Solution: Unified progress + clean UI

&nbsp;     142 -

&nbsp;     143 -\*\*New: useAnalysisProgress.ts\*\* — single shared hook replacing both WebSocket consumers:

&nbsp;     144 -- One WebSocket connection

&nbsp;     145 -- Clean state: `currentPhase`, `currentPhaseLabel`, `overallPercent`, `currentUrlIndex/totalUrls`,

&nbsp;         -`elementsFound`, `elapsedSeconds`

&nbsp;     146 -- Maps technical steps to plain English: "Scanning page elements...", "Checking for hidden

&nbsp;         -content..."

&nbsp;     147 -

&nbsp;     148 -\*\*AnalysisProgressModal.tsx\*\* — redesign:

&nbsp;     149 -- Replace raw event log with step-progress stepper: Prepare → Scan → Save → Done

&nbsp;     150 -- Main area: current action in plain English + progress bar + "Page 2 of 5 | 87 elements found"

&nbsp;     151 -- "Show details" toggle for the log (collapsed by default)

&nbsp;     152 -

&nbsp;     153 -\*\*AnalysisFloatingIndicator.tsx\*\* — update to use shared hook state:

&nbsp;     154 -- "Scanning: ProjectName" + "Page 2/5 | 87 elements" + progress bar

&nbsp;     155 -

&nbsp;     156 -\*\*Backend\*\* — add `friendlyMessage` to progress events so frontend doesn't need to parse step names.

&nbsp;     157 -

&nbsp;     158 -### Files

&nbsp;     159 -- `frontend/src/hooks/useAnalysisProgress.ts` (new)

&nbsp;     160 -- `frontend/src/components/analysis/AnalysisProgressModal.tsx`

&nbsp;     161 -- `frontend/src/components/analysis/AnalysisFloatingIndicator.tsx`

&nbsp;     162 -- `frontend/src/pages/projects/ProjectDetailsPage.tsx`

&nbsp;     163 -- `backend/src/projects/project-analysis.service.ts` — friendlyMessage field

&nbsp;     164 -- `backend/src/analysis/analysis-progress.gateway.ts`

&nbsp;     165 -

&nbsp;     166 ----

&nbsp;     167 -

&nbsp;     168 -## Phase 5: Hidden Element Discovery — Tabs \& Forms

&nbsp;     169 -\*\*Issue: #8 (popups, tabs, form sections not discovered)\*\*

&nbsp;     170 -

&nbsp;     171 -### Add tab panel detection

&nbsp;     172 -

&nbsp;     173 -\*\*interactive-element-discovery.service.ts\*\* — new trigger type `'tab'`:

&nbsp;     174 -- Detect: `\[role="tab"]:not(\[aria-selected="true"])`, `\[data-bs-toggle="tab"]:not(.active)`,

&nbsp;         -`.nav-tabs .nav-link:not(.active)`

&nbsp;     175 -- Click each inactive tab → scan revealed `\[role="tabpanel"]` / `.tab-pane.active` content

&nbsp;     176 -- Restore original active tab after scanning (click it back)

&nbsp;     177 -- No "close" action needed (tabs persist, unlike modals)

&nbsp;     178 -

&nbsp;     179 -### Better form/popup scanning

&nbsp;     180 -- After clicking ANY trigger, also scan for newly visible: `form`, `input`, `select`, `textarea`,

&nbsp;         -`\[role="form"]`

&nbsp;     181 -- Scan tab panels: `\[role="tabpanel"]:not(\[hidden])`, `.tab-pane.active`

&nbsp;     182 -

&nbsp;     183 -### Element organization

&nbsp;     184 -- Each discovered element already has `discoveryState` + `discoveryTrigger`

&nbsp;     185 -- Add `'tab'` to discoveryState enum

&nbsp;     186 -- Frontend groups by trigger context naturally (elements carry their source info)

&nbsp;     187 -

&nbsp;     188 -### Files

&nbsp;     189 -- `backend/src/ai/interactive-element-discovery.service.ts`

&nbsp;     190 -- `backend/src/ai/interfaces/element.interface.ts` (add 'tab' to discoveryState)

&nbsp;     191 -

&nbsp;     192 ----

&nbsp;     193 -

&nbsp;     194 -## Phase 6: Localhost Discovery Fix

&nbsp;     195 -\*\*Issue: #9 (discovery not finding URLs on localhost)\*\*

&nbsp;     196 -

&nbsp;     197 -### Root cause analysis

&nbsp;     198 -Most likely failures (in order of probability):

&nbsp;     199 -

&nbsp;     200 -1. \*\*Domain mismatch filtering\*\* — After Docker translates `localhost` → `host.docker.internal`, SPA

&nbsp;         -links with `href="http://localhost:3001/foo"` are filtered as "external" because `localhost !==

&nbsp;         -host.docker.internal`

&nbsp;     201 -2. \*\*SPA routing\*\* — React apps use client-side routing; `<a href>` tags exist but domain comparison

&nbsp;         -fails after translation

&nbsp;     202 -3. \*\*Sitemap service\*\* — `SitemapParserService.isLocalAddress()` doesn't recognize

&nbsp;         -`host.docker.internal`

&nbsp;     203 -4. \*\*Chromium DNS\*\* — Browser inside Docker may not resolve `host.docker.internal` (uses system

&nbsp;         -`/etc/hosts`)

&nbsp;     204 -

&nbsp;     205 -### Fixes

&nbsp;     206 -

&nbsp;     207 -\*\*link-discovery.service.ts\*\* — Fix domain comparison:

&nbsp;     208 -```javascript

&nbsp;     209 -const normalizeDomain = (d) => {

&nbsp;     210 -  if (d === '127.0.0.1' || d === 'host.docker.internal') return 'localhost';

&nbsp;     211 -  return d;

&nbsp;     212 -};

&nbsp;     213 -// Use normalizeDomain() in domain equality check

&nbsp;     214 -```

&nbsp;     215 -

&nbsp;     216 -\*\*sitemap-parser.service.ts\*\* — Add `host.docker.internal` to `isLocalAddress()`.

&nbsp;     217 -

&nbsp;     218 -\*\*Add diagnostic logging\*\* to `crawlWithDepth()` and `crawlPage()`:

&nbsp;     219 -- Log exact URL being navigated

&nbsp;     220 -- Log number of links found

&nbsp;     221 -- Log any links filtered as external (with domain mismatch reason)

&nbsp;     222 -

&nbsp;     223 -\*\*If browser navigation fails\*\* — add `--host-resolver-rules` to Chromium launch args.

&nbsp;     224 -

&nbsp;     225 -### Files

&nbsp;     226 -- `backend/src/discovery/link-discovery.service.ts`

&nbsp;     227 -- `backend/src/discovery/sitemap-parser.service.ts`

&nbsp;     228 -- `backend/src/discovery/page-crawler.service.ts` (diagnostic logging)

&nbsp;     229 -- `backend/src/discovery/discovery.service.ts` (diagnostic logging)

&nbsp;     230 -

&nbsp;     231 ----

&nbsp;     232 -

&nbsp;     233 -## Execution Order

&nbsp;     234 -

&nbsp;     235 -| Order | Phase | Risk | Reason |

&nbsp;     236 -|-------|-------|------|--------|

&nbsp;     237 -| 1 | Phase 6: Localhost fix | Medium | Debug-first — need to find actual failure point |

&nbsp;     238 -| 2 | Phase 1: Card UX cleanup | Low | Pure frontend, no backend changes |

&nbsp;     239 -| 3 | Phase 3: Analyzer speed | Low | Remove screenshot calls, skip redundant second pass |

&nbsp;     240 -| 4 | Phase 4: Progress UX | Low | Frontend refactor, additive backend field |

&nbsp;     241 -| 5 | Phase 2: Table usability | Low | Backend + frontend, fully additive |

&nbsp;     242 -| 6 | Phase 5: Hidden elements | Low | Backend only, additive trigger type |

&nbsp;     243 -

&nbsp;     244 ----

&nbsp;     245 -

&nbsp;     246 -## Verification

&nbsp;     247 -

&nbsp;     248 -After each phase:

&nbsp;     249 -1. TypeScript compiles clean (backend + frontend)

&nbsp;     250 -2. Manual test at localhost:3001 — verify the specific feature works

&nbsp;     251 -3. No regressions in existing functionality

&nbsp;     252 -

&nbsp;     253 -End-to-end test:

&nbsp;     254 -1. Create project with localhost:3001 URL → discovery finds pages (Phase 6)

&nbsp;     255 -2. Analyze pages → elements appear fast, ~5-10s per page (Phase 3)

&nbsp;     256 -3. Progress shows clean "Scanning page 1 of 3..." (Phase 4)

&nbsp;     257 -4. Element cards are clean, clickable, no clutter (Phase 1)

&nbsp;     258 -5. Table elements have explorer with cell selectors + assertions (Phase 2)

&nbsp;     259 -6. Tabs/modals discovered and grouped properly (Phase 5)

&nbsp;       1 +# Sprint 2: Post-Testing Fixes — 6 Issues

&nbsp;       2 +

&nbsp;       3 +## Context

&nbsp;       4 +

&nbsp;       5 +User tested the product after the previous sprint (6 phases of element library \& analyzer

&nbsp;         +improvements). All 6 phases work, but testing revealed 6 new issues that need fixing. This plan

&nbsp;         +addresses all 6.

&nbsp;       6 +

&nbsp;       7 +---

&nbsp;       8 +

&nbsp;       9 +## Phase 1: Fix Error Handling \& WebSocket Churn (Issue #1)

&nbsp;      10 +

&nbsp;      11 +\*\*Problem\*\*: User sees ERR\_1001 "Unauthorized" errors when entering elements tab after analysis.

&nbsp;         +Excessive WebSocket connect/disconnect churn in console.

&nbsp;      12 +

&nbsp;      13 +\*\*Root cause (confirmed via code investigation)\*\*:

&nbsp;      14 +1. \*\*GlobalExceptionFilter bug\*\* (`backend/src/common/filters/global-exception.filter.ts:51-68`): ALL

&nbsp;         + NestJS HttpExceptions with a `message` property get code `VALIDATION\_ERROR` (ERR\_1001) — even

&nbsp;         +401/403 errors. The filter should check HTTP status and map to the correct error code.

&nbsp;      15 +2. \*\*Double WebSocket connections\*\*: `useProjectWebSocket.ts` and `useAnalysisProgress.ts` BOTH

&nbsp;         +connect to `/analysis-progress` namespace independently. Two connections = double subscriptions,

&nbsp;         +double events, double churn.

&nbsp;      16 +3. \*\*Possible OrganizationGuard failure\*\*: If `organizationId` is missing from localStorage, the API

&nbsp;         +interceptor sends requests without it, and OrganizationGuard fails — but gets wrapped with wrong

&nbsp;         +error code.

&nbsp;      17 +

&nbsp;      18 +### Changes

&nbsp;      19 +

&nbsp;      20 +\*\*Fix GlobalExceptionFilter error code mapping:\*\*

&nbsp;      21 +- `backend/src/common/filters/global-exception.filter.ts` (line 62)

&nbsp;      22 +- Replace hardcoded `ErrorCode.VALIDATION\_ERROR` with `this.mapHttpStatusToErrorCode(status)` for all

&nbsp;         + HttpExceptions

&nbsp;      23 +- This makes 401s show as ERR\_1003 UNAUTHORIZED, 403s as ERR\_1004 FORBIDDEN, etc.

&nbsp;      24 +

&nbsp;      25 +\*\*Consolidate WebSocket connections:\*\*

&nbsp;      26 +- `frontend/src/pages/projects/ProjectDetailsPage.tsx`

&nbsp;      27 +- Remove `useProjectWebSocket` usage — `useAnalysisProgress` already handles the same events

&nbsp;      28 +- Wire `useAnalysisProgress` events to drive the same state (analyzing, currentStep, logs)

&nbsp;      29 +- OR: If `useProjectWebSocket` has unique functionality (auto-refresh), merge it into

&nbsp;         +`useAnalysisProgress`

&nbsp;      30 +

&nbsp;      31 +\*\*Files:\*\*

&nbsp;      32 +- `backend/src/common/filters/global-exception.filter.ts`

&nbsp;      33 +- `frontend/src/pages/projects/ProjectDetailsPage.tsx`

&nbsp;      34 +- `frontend/src/pages/projects/hooks/useProjectWebSocket.ts` (may delete or merge)

&nbsp;      35 +- `frontend/src/hooks/useAnalysisProgress.ts`

&nbsp;      36 +

&nbsp;      37 +---

&nbsp;      38 +

&nbsp;      39 +## Phase 2: Multi-Auth Flow Analysis (Issue #2)

&nbsp;      40 +

&nbsp;      41 +\*\*Problem\*\*: Analysis only uses the first auth flow (`authFlows\[0]`). User wants elements discovered

&nbsp;         +under different auth roles (admin, user, guest).

&nbsp;      42 +

&nbsp;      43 +\*\*Root cause (confirmed):\*\*

&nbsp;      44 +- `backend/src/projects/project-analysis.service.ts:103-104`: `const authFlow = authFlows.length > 0

&nbsp;         +? authFlows\[0] : null;` — always picks only the first auth flow

&nbsp;      45 +- DB schema already supports it: `ProjectElement` has `authFlowId` field, `AuthFlow` has `elements`

&nbsp;         +relation

&nbsp;      46 +- `analyzeAllUrlsWithAuth()` accepts a single `authFlow` — need to call it per flow

&nbsp;      47 +

&nbsp;      48 +### Changes

&nbsp;      49 +

&nbsp;      50 +\*\*Backend: Iterate all auth flows:\*\*

&nbsp;      51 +- `backend/src/projects/project-analysis.service.ts`

&nbsp;      52 +  - `analyzeProjectPages()`: Loop through ALL auth flows instead of picking `authFlows\[0]`

&nbsp;      53 +  - For each auth flow: call `performAuthenticatedAnalysis()` with that flow

&nbsp;      54 +  - After all auth flows: run one unauthenticated pass for public elements

&nbsp;      55 +  - Tag stored elements with `authFlowId` from each flow

&nbsp;      56 +  - Progress: "Scanning as Admin (1/3)..." → "Scanning as User (2/3)..." → "Public scan (3/3)..."

&nbsp;      57 +

&nbsp;      58 +\*\*Backend: Tag elements with auth flow:\*\*

&nbsp;      59 +- `backend/src/projects/project-elements.service.ts`

&nbsp;      60 +  - When storing elements, set `authFlowId` from the flow used to discover them

&nbsp;      61 +  - Deduplicate: elements found across multiple flows should reference the first flow but be flagged

&nbsp;         +`isCommon: true`

&nbsp;      62 +

&nbsp;      63 +\*\*Frontend: Group elements by auth flow:\*\*

&nbsp;      64 +- `frontend/src/components/test-builder/ElementLibraryPanel.tsx`

&nbsp;      65 +  - Add grouping toggle: "Group by: Page | Auth Role"

&nbsp;      66 +  - When grouped by auth role: show sections like "Admin-only elements", "User elements", "Public

&nbsp;         +elements"

&nbsp;      67 +  - Show auth flow name badge on elements that require auth

&nbsp;      68 +

&nbsp;      69 +\*\*Files:\*\*

&nbsp;      70 +- `backend/src/projects/project-analysis.service.ts`

&nbsp;      71 +- `backend/src/projects/project-elements.service.ts`

&nbsp;      72 +- `frontend/src/components/test-builder/ElementLibraryPanel.tsx`

&nbsp;      73 +- `frontend/src/types/element.types.ts` (add `authFlowName` to display type)

&nbsp;      74 +

&nbsp;      75 +---

&nbsp;      76 +

&nbsp;      77 +## Phase 3: Dropdown Grouping with Option Selectors (Issue #3)

&nbsp;      78 +

&nbsp;      79 +\*\*Problem\*\*: Dropdown elements show as a single element. User wants each option to be individually

&nbsp;         +accessible with its own selector and CSS preview.

&nbsp;      80 +

&nbsp;      81 +\*\*Current state (confirmed):\*\*

&nbsp;      82 +- Backend already extracts `dropdownOptions` (element-detection.service.ts:1059-1081): value, text,

&nbsp;         +selected state

&nbsp;      83 +- Options don't have individual CSS data or selectors

&nbsp;      84 +

&nbsp;      85 +### Changes

&nbsp;      86 +

&nbsp;      87 +\*\*Backend: Expand dropdown option extraction:\*\*

&nbsp;      88 +- `backend/src/ai/element-detection.service.ts` (around line 1059)

&nbsp;      89 +  - For native `<select>`: generate selectors per option — `select\[name="x"] option\[value="y"]` or

&nbsp;         +`select\[name="x"] option:nth-child(N)`

&nbsp;      90 +  - For custom dropdowns (ARIA): generate selectors per option — `\[role="option"]:nth-child(N)`, or

&nbsp;         +option with specific text

&nbsp;      91 +  - Extract basic CSS for each option (color, background, font)

&nbsp;      92 +  - Add `optionSelectors\[]` and `optionCSSInfo\[]` to dropdown data

&nbsp;      93 +

&nbsp;      94 +\*\*Frontend: Create DropdownPreviewCard:\*\*

&nbsp;      95 +- `frontend/src/components/elements/DropdownPreviewCard.tsx` (new)

&nbsp;      96 +  - Similar pattern to `TablePreviewCard`

&nbsp;      97 +  - Shows dropdown trigger with its selector

&nbsp;      98 +  - Lists all options with: text, value, individual selector, copy button

&nbsp;      99 +  - Click any option → popover with selector + assertion template

&nbsp;     100 +  - "Explore" mode shows all options with CSS preview

&nbsp;     101 +

&nbsp;     102 +\*\*Frontend: Wire into ElementLibraryPanel:\*\*

&nbsp;     103 +- `frontend/src/components/test-builder/ElementLibraryPanel.tsx`

&nbsp;     104 +  - Check if element has `dropdownOptions` data

&nbsp;     105 +  - Render `DropdownPreviewCard` instead of `ElementPreviewCard` for dropdowns

&nbsp;     106 +

&nbsp;     107 +\*\*Files:\*\*

&nbsp;     108 +- `backend/src/ai/element-detection.service.ts`

&nbsp;     109 +- `frontend/src/components/elements/DropdownPreviewCard.tsx` (new)

&nbsp;     110 +- `frontend/src/components/test-builder/ElementLibraryPanel.tsx`

&nbsp;     111 +- `frontend/src/types/element.types.ts` (add dropdown option types)

&nbsp;     112 +

&nbsp;     113 +---

&nbsp;     114 +

&nbsp;     115 +## Phase 4: Popup Window Detection \& Analysis (Issue #4)

&nbsp;     116 +

&nbsp;     117 +\*\*Problem\*\*: Interactive discovery doesn't detect `window.open()` popups. It only detects URL

&nbsp;         +navigation (and goes back).

&nbsp;     118 +

&nbsp;     119 +\*\*Root cause (confirmed):\*\*

&nbsp;     120 +- `interactive-element-discovery.service.ts:200`: `if (page.url() !== currentUrl)` — only checks

&nbsp;         +navigation

&nbsp;     121 +- No `page.on('popup')` handler to capture opened popup windows

&nbsp;     122 +- Playwright supports popup detection natively

&nbsp;     123 +

&nbsp;     124 +### Changes

&nbsp;     125 +

&nbsp;     126 +\*\*Backend: Add popup window handling to tryTrigger():\*\*

&nbsp;     127 +- `backend/src/ai/interactive-element-discovery.service.ts`

&nbsp;     128 +  - Before clicking trigger, register `page.on('popup', handler)`

&nbsp;     129 +  - If popup detected:

&nbsp;     130 +    1. Wait for popup page to load

&nbsp;     131 +    2. Extract elements from popup page (same `page.evaluate()` as main page)

&nbsp;     132 +    3. Tag elements with `discoveryState: 'popup'`, `discoveryTrigger: 'Popup from "Button Text"'`

&nbsp;     133 +    4. Close popup page

&nbsp;     134 +    5. Return to original page

&nbsp;     135 +  - Add `'popup'` to InteractiveTrigger.triggerType union

&nbsp;     136 +  - Add `'popup'` to DetectedElement.discoveryState union

&nbsp;     137 +

&nbsp;     138 +\*\*Frontend: Show popup-discovered elements:\*\*

&nbsp;     139 +- Elements from popups automatically get the `discoveryState: 'popup'` badge

&nbsp;     140 +- `frontend/src/components/elements/ElementPreviewCard.tsx` — add 'popup' to badge config (purple

&nbsp;         +badge)

&nbsp;     141 +

&nbsp;     142 +\*\*Files:\*\*

&nbsp;     143 +- `backend/src/ai/interactive-element-discovery.service.ts`

&nbsp;     144 +- `backend/src/ai/interfaces/element.interface.ts` (add 'popup' to discoveryState)

&nbsp;     145 +- `frontend/src/components/elements/ElementPreviewCard.tsx` (add popup badge)

&nbsp;     146 +

&nbsp;     147 +---

&nbsp;     148 +

&nbsp;     149 +## Phase 5: Discovery UX — Progress Modal \& Background Task (Issue #5)

&nbsp;     150 +

&nbsp;     151 +\*\*Problem\*\*: Discovery popup blocks the UI. No progress indicator when minimized. Should work like

&nbsp;         +analysis (WebSocket progress + floating indicator).

&nbsp;     152 +

&nbsp;     153 +\*\*Root cause (confirmed):\*\*

&nbsp;     154 +- Discovery uses polling (HTTP GET every 3s) not WebSocket

&nbsp;     155 +- No discovery progress gateway exists

&nbsp;     156 +- DiscoveryModal is a blocking full-screen modal

&nbsp;     157 +- Analysis has a floating indicator pattern that works well

&nbsp;     158 +

&nbsp;     159 +### Changes

&nbsp;     160 +

&nbsp;     161 +\*\*Backend: Create Discovery Progress Gateway:\*\*

&nbsp;     162 +- `backend/src/discovery/discovery-progress.gateway.ts` (new)

&nbsp;     163 +  - Same pattern as `analysis-progress.gateway.ts`

&nbsp;     164 +  - Events: `discovery-started`, `discovery-progress`, `discovery-completed`, `discovery-error`

&nbsp;     165 +  - Subscribe to project, receive real-time updates

&nbsp;     166 +  - Wire into `discovery.service.ts` — emit events instead of just updating in-memory Map

&nbsp;     167 +

&nbsp;     168 +\*\*Frontend: Create useDiscoveryProgress hook:\*\*

&nbsp;     169 +- `frontend/src/hooks/useDiscoveryProgress.ts` (new)

&nbsp;     170 +  - Same pattern as `useAnalysisProgress.ts`

&nbsp;     171 +  - WebSocket connection to `/discovery-progress` namespace

&nbsp;     172 +  - State: phase, message, urlsFound, progress percent

&nbsp;     173 +

&nbsp;     174 +\*\*Frontend: Update DiscoveryModal behavior:\*\*

&nbsp;     175 +- `frontend/src/components/sitemap/DiscoveryModal.tsx`

&nbsp;     176 +  - When "Start Discovery" clicked: close modal → show floating indicator

&nbsp;     177 +  - Remove polling logic, use WebSocket hook instead

&nbsp;     178 +  - Keep modal available for configuration (URL, depth, sitemap toggle)

&nbsp;     179 +  - Don't block UI during discovery

&nbsp;     180 +

&nbsp;     181 +\*\*Frontend: Create DiscoveryFloatingIndicator:\*\*

&nbsp;     182 +- `frontend/src/components/sitemap/DiscoveryFloatingIndicator.tsx` (new)

&nbsp;     183 +  - Similar to `AnalysisFloatingIndicator`

&nbsp;     184 +  - Shows: "Discovering pages... 12 found" + progress bar

&nbsp;     185 +  - Click → re-open DiscoveryModal with progress details

&nbsp;     186 +

&nbsp;     187 +\*\*Files:\*\*

&nbsp;     188 +- `backend/src/discovery/discovery-progress.gateway.ts` (new)

&nbsp;     189 +- `backend/src/discovery/discovery.module.ts` (register gateway)

&nbsp;     190 +- `backend/src/discovery/discovery.service.ts` (emit WebSocket events)

&nbsp;     191 +- `frontend/src/hooks/useDiscoveryProgress.ts` (new)

&nbsp;     192 +- `frontend/src/components/sitemap/DiscoveryModal.tsx` (remove polling, add auto-close)

&nbsp;     193 +- `frontend/src/components/sitemap/DiscoveryFloatingIndicator.tsx` (new)

&nbsp;     194 +- `frontend/src/pages/projects/ProjectDetailsPage.tsx` (wire floating indicator)

&nbsp;     195 +

&nbsp;     196 +---

&nbsp;     197 +

&nbsp;     198 +## Phase 6: Non-Docker Localhost Detection (Issue #6)

&nbsp;     199 +

&nbsp;     200 +\*\*Problem\*\*: localhost:3000 (npm project, not Docker) not discovered. Only Docker-based

&nbsp;         +localhost:3001 works.

&nbsp;     201 +

&nbsp;     202 +\*\*Root cause (investigation):\*\*

&nbsp;     203 +- URL translation works correctly: `localhost:3000` → `host.docker.internal:3000`

&nbsp;     204 +- `docker-compose.yml` has `extra\_hosts: host.docker.internal:host-gateway` on backend

&nbsp;     205 +- Chromium browser launched inside Docker may not resolve `host.docker.internal`

&nbsp;     206 +- Browser launch args in `page-crawler.service.ts` don't include Docker DNS hints

&nbsp;     207 +- The browser context needs `--host-resolver-rules` to resolve `host.docker.internal` to the host IP

&nbsp;     208 +

&nbsp;     209 +### Changes

&nbsp;     210 +

&nbsp;     211 +\*\*Backend: Add host-resolver-rules to browser launch:\*\*

&nbsp;     212 +- `backend/src/discovery/page-crawler.service.ts`

&nbsp;     213 +  - Add `--host-resolver-rules=MAP host.docker.internal host-gateway` to Chromium launch args

&nbsp;     214 +  - OR: Resolve `host.docker.internal` to actual IP at launch time and pass it

&nbsp;     215 +

&nbsp;     216 +\*\*Backend: Better localhost detection logging:\*\*

&nbsp;     217 +- `backend/src/discovery/discovery.service.ts`

&nbsp;     218 +  - Log the translated URL before navigation

&nbsp;     219 +  - Log if navigation fails with network error

&nbsp;     220 +  - Surface the error clearly: "Cannot reach localhost:3000 from Docker container"

&nbsp;     221 +

&nbsp;     222 +\*\*Backend: Add connectivity check before crawling:\*\*

&nbsp;     223 +- Before starting discovery, do a quick HTTP HEAD request to the translated URL

&nbsp;     224 +- If it fails, return a clear error: "Cannot reach this URL. If running locally, make sure the app is

&nbsp;         + accessible from Docker"

&nbsp;     225 +

&nbsp;     226 +\*\*Files:\*\*

&nbsp;     227 +- `backend/src/discovery/page-crawler.service.ts` (browser launch args)

&nbsp;     228 +- `backend/src/discovery/discovery.service.ts` (connectivity check + logging)

&nbsp;     229 +

&nbsp;     230 +---

&nbsp;     231 +

&nbsp;     232 +## Execution Order

&nbsp;     233 +

&nbsp;     234 +| Order | Phase | Risk | Dependencies |

&nbsp;     235 +|-------|-------|------|-------------|

&nbsp;     236 +| 1 | Phase 1: Error handling \& WebSocket | Low | None — pure bugfix |

&nbsp;     237 +| 2 | Phase 6: Localhost detection | Low | None — isolated change |

&nbsp;     238 +| 3 | Phase 5: Discovery UX | Medium | New WebSocket gateway |

&nbsp;     239 +| 4 | Phase 3: Dropdown grouping | Low | Backend + new component |

&nbsp;     240 +| 5 | Phase 4: Popup detection | Medium | Interactive discovery changes |

&nbsp;     241 +| 6 | Phase 2: Multi-auth flow | High | Touches analysis pipeline |

&nbsp;     242 +

&nbsp;     243 +---

&nbsp;     244 +

&nbsp;     245 +## Verification

&nbsp;     246 +

&nbsp;     247 +After each phase:

&nbsp;     248 +1. TypeScript compiles clean (backend + frontend)

&nbsp;     249 +2. Docker rebuild: `docker-compose up --build`

&nbsp;     250 +3. Manual test at localhost:3001

&nbsp;     251 +

&nbsp;     252 +End-to-end tests:

&nbsp;     253 +- \*\*Phase 1\*\*: Navigate between tabs — no ERR\_1001 errors, single WebSocket connection in DevTools

&nbsp;     254 +- \*\*Phase 2\*\*: Add 2 auth flows → analyze → elements grouped by role

&nbsp;     255 +- \*\*Phase 3\*\*: Analyze page with dropdowns → see option list with individual selectors

&nbsp;     256 +- \*\*Phase 4\*\*: Analyze page with popup triggers → popup elements discovered

&nbsp;     257 +- \*\*Phase 5\*\*: Start discovery → modal closes → floating indicator shows progress

&nbsp;     258 +- \*\*Phase 6\*\*: Enter localhost:3000 URL → discovery finds pages from npm project

