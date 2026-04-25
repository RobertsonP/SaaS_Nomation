# Surgical Fix Plan — 3 Issues: Investigation & Proposal
Date: 2026-04-21

## Task
User reported three issues, asked for a verified, surgical plan. No code was modified today — investigation and planning only, pending user answers to two clarifying questions.

## Issues Reported
1. **URL case bug** — discovery lowercases all URLs, breaking case-sensitive paths (observed on "litarch" book pages with uppercase path segments).
2. **Page name UX** — users cannot set a title for a URL in the UI; element library grouping suffers. User wants URL-path fallback when no title is set.
3. **Live picker slow / broken** — user proposes replacing screenshot-click flow with client-side render of the page DOM.

## Investigation (3 parallel Explore agents)

### Issue 1 — Root cause confirmed
- `backend/src/discovery/url-normalization.service.ts:30` lowercases path
- `backend/src/discovery/url-normalization.service.ts:59` lowercases entire final URL (scheme + host + path + query)
- `backend/src/discovery/url-normalization.service.ts:62` catch-fallback lowercases entire URL
- `backend/src/discovery/discovery.service.ts:853-892` contains a **duplicate copy** of the same buggy `normalizeUrl` method (should not exist — `UrlNormalizationService` is already DI-registered)
- `backend/src/discovery/link-discovery.service.ts:125` — `new Set(allLinks.map(l => l.url))` de-duplicates raw URLs; depends on prior lowercasing to merge case-variants. If we fix the lowercasing, this set will fail to dedupe URLs differing only in case.
- `backend/prisma/schema.prisma:119` — `ProjectUrl.url` is `String` with NO `@unique` constraint, so no DB-level dedupe to worry about.

**Per RFC 3986:** scheme + host are case-insensitive, path + query are case-sensitive. Correct normalization = lowercase scheme + host only.

### Issue 2 — Verified state of the code
- `ProjectUrl.title` is `String?` nullable (`schema.prisma:120`). Exists.
- `backend/src/discovery/page-crawler.service.ts:267-323` — discovery auto-captures page title with 8-level fallback chain, ultimately calls `generateTitleFromUrl()` (`url-normalization.service.ts:99-127`).
- `frontend/src/components/test-builder/ElementLibraryPanel.tsx:152` — **the URL-path fallback already exists**: `el.sourceUrl?.title || getPathFromUrl(url)`.
- `frontend/src/components/test-builder/ElementLibraryPanel.tsx:156` — page list is sorted `sort((a, b) => b.count - a.count)` (by element count descending, NOT by name). This is likely what the user is calling "sorting not correct."
- `frontend/src/pages/projects/components/ProjectUrlsTab.tsx` exists and displays `url.title`, but has **no inline rename UI** — only Verify and Remove buttons.
- `backend/src/projects/projects.controller.ts:260` — only `POST urls/:urlId/verify` exists; **no PATCH/PUT endpoint for updating a URL's title**.

### Issue 3 — Live picker performance root cause
- `backend/src/browser/live-browser.service.ts:297-576` — `captureCurrentElements()` is a 450-line `page.evaluate()` that iterates ~15 CSS selector types, calling `document.querySelectorAll()` per selector AND per element for uniqueness testing. Worst case ~5000+ querySelectorAll calls per capture → **4-7 seconds wall-clock**.
- Plus JPEG screenshot encode (1-3s). Total per capture: **5-10s**.
- Click-on-screenshot → frontend does bounding-rect hit-test against captured element list → misaligned if the page reflowed between capture and click.
- `frontend/src/components/element-picker/BrowserPreview.tsx` already exists as an iframe-based picker but is broken for cross-origin sites (CORS blocks injection at line 77).

**User's DOM-render proposal is feasible via:**
- Backend adds `html` (from `page.content()` — post-render DOM) and `baseHref` to `capturePageState()` response.
- Frontend renders `<iframe srcDoc={html} sandbox="allow-same-origin">` — static DOM, no script re-exec.
- Click handlers attach to `iframe.contentDocument` — user clicks real DOM elements, no bounding-rect math.
- Selector generation via existing `frontend/src/components/element-picker/SelectorGenerator.ts` (already used by BrowserPreview).

**Trade-offs:** external CSS/images may fail CORS (visual degradation but still pickable); no hover/focus states; no dynamic content post-snapshot. Acceptable for picking.

## Proposed Fixes (Surgical)

### Fix 1 — URL case preservation (3 files)
- `url-normalization.service.ts:28-30, 59, 62` — drop `.toLowerCase()` on path and full URL; lowercase only scheme + host.
- `discovery.service.ts:853-892` — delete the duplicate `normalizeUrl` method; inject `UrlNormalizationService`.
- `link-discovery.service.ts:125` — normalize URLs before adding to the dedup Set.

**Migration:** no schema change. Already-corrupted URLs in projects like "litarch" must be re-discovered — there is no safe way to reverse-engineer original case.

### Fix 2 — Page rename UI (2 files)
- `backend/src/projects/projects.controller.ts` — add `PATCH urls/:urlId` handler accepting `{ title }`.
- `frontend/src/pages/projects/components/ProjectUrlsTab.tsx` — inline rename button per row, input + save/cancel, calls the new endpoint.
- No change to ElementLibraryPanel (fallback already works).

**Open question** — element library page sort: alphabetical, count-then-name tiebreaker, or user toggle?

### Fix 3 — DOM-render picker (3 files)
- `backend/src/browser/live-browser.service.ts:728` — extend `capturePageState()` to return `{ html, baseHref, ...existing }`.
- `frontend/src/components/element-picker/LiveElementPicker.tsx` — replace `<img onClick>` flow with `<iframe srcDoc onLoad>` flow; attach listeners to iframe document; reuse `SelectorGenerator`.
- `frontend/src/lib/api.ts` — update `capturePageState()` response type.

**Open question** — keep the "all detected elements" sidebar (requires keeping `captureCurrentElements` server-side) or remove it and rely purely on iframe clicks?

## Execution Order
1. Fix 1 (URL bug) — 1 hr, low risk
2. Fix 2 (Rename UI) — 1 hr, low risk
3. Fix 3 (DOM picker) — 3-4 hrs, medium risk

## Blocked On
- User's answer to sort-order question (Fix 2 style)
- User's answer to sidebar question (Fix 3 scope)

## Files Changed
None today. Read-only investigation + plan.

## What Happened
Ran three parallel Explore agents to verify each reported issue against actual code. Findings confirmed, locations pinned to file:line. Surgical fix shape is clear for all three. Waiting on two clarifying answers from user before entering plan mode and executing.
