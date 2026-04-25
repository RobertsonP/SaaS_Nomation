# Browser Walkthrough — Issues Found
Date: 2026-04-25
Method: User-driven walkthrough; Claude drives Chromium via Playwright MCP and records issues as the user calls them out.

## Format
Each issue has:
- **#** sequence number
- **Where**: page / component / file:line if known
- **What**: what's broken
- **Expected**: what the user wants instead
- **Evidence**: screenshot path or snapshot ref
- **Severity**: blocker / major / minor

---

## Issues

### #1 — Element library sidebar hides pages until you paginate in
- **Where**: Project Details → Elements tab → left sidebar (page list). Component: `frontend/src/components/test-builder/ElementLibraryPanel.tsx:148-157`.
- **What**: The page list is computed from the currently-loaded elements (`filteredElements`), which is paginated 50 at a time. Real reproduction on project "tts" (11 URLs, 295 elements):
  - 50 / 295 loaded → 2 pages visible (Page /, TTS /)
  - 100 / 295 loaded → 2 pages still, but "TTS /" count jumped 12 → 62
  - 250 / 295 loaded → 8 pages finally visible (Page /, TTS /, TTS /insuranceGE, TTS /consultation, TTS /invoices, TTS /insurance, TTS /dashboard, Login Page /login)
  - User has to keep clicking Load More to discover that other pages exist.
- **Side effects**:
  - The selected page can flip mid-pagination because the count-desc sort re-orders pages as more elements load (started on "Page", jumped to "TTS" when its count overtook).
  - Element counts in the sidebar are misleading (loaded-so-far, not the real DB count per page).
- **Expected**:
  - Sidebar shows the FULL page list with actual element-count-per-page from the database from the very first render — independent of pagination.
  - Counts match the per-page totals stored in the DB.
  - Selected page is preserved across Load More.
- **Severity**: major — breaks page discoverability on any project with >50 elements.
- **Evidence**: `element-library-tab.png` (initial state); snapshot history this conversation.

### #2 — Footer elements duplicated across pages (same element stored once per page)
- **Where**: backend element detection (likely `backend/src/ai/element-detection.service.ts` and storage path in `backend/src/projects/project-elements.service.ts`). Visible symptom is in the Elements tab on any project with multiple analyzed URLs.
- **What**: The site footer is identical on every page (Consultation, Contact Us, Documentation, FAQ, Help Center, Insurance, Privacy, Registration, Terms, Terms of Service, Read More). When the analyzer scans 8 pages, the SAME footer link is stored 8 times — once per `sourceUrl`. With 50 elements loaded the user already saw "link Consultation in footer" appear twice; "link Contact Us in footer" twice; etc. Same link text, same selector, same DOM region — N copies.
- **Why this happens**: the unique constraint `@@unique([projectId, selector, sourceUrlId])` (per `schema.prisma:250`) treats `sourceUrlId` as part of the dedup key. So the same selector with two different sourceUrlIds = two rows. There is no project-level dedup on "this selector appeared in the same shared chrome (header/footer/nav) on multiple pages."
- **Expected** (DECIDED 2026-04-25): repetitive elements (footer, top nav, sidebar, header — anything in shared site chrome) must be grouped into ONE dedicated bucket in the element library sidebar, NOT duplicated under every page. Page-specific elements stay under their page. Detection strategy = **B (region-based)**: rely on the analyzer's region label already present in the description ("in footer", "in top navigation", "in sidebar", "in header"). Only elements with a known chrome region go into the Shared bucket.
- **Sidebar shape after fix**:
  - "Shared elements" (count) — single combined bucket for all chrome regions across all pages
  - Page / (count) — only homepage-unique elements
  - TTS /consultation (count) — only consultation-page-unique elements
  - …etc.
- **Open implementation question to resolve during plan-write**: do we dedup at the storage layer (add a `region` field on `ProjectElement`, treat shared-region elements with identical selectors as one row across pages) or at the render layer (current storage, group in `ElementLibraryPanel`)? Render-only is faster to ship; storage dedup is more correct long-term. Default recommendation: render-only first (Phase 1), storage dedup later if ambiguity arises.
- **Severity**: major — bloats element library, confuses test-step authoring (which copy do I pick?). Project "tts" shows 5–10× duplication.
- **Evidence**: snapshot showed "link Consultation in footer" at refs e1104 and e1126; "link Contact Us in footer" at e1148 and e1169; "link Documentation in footer" at e1234 and e1256; same pattern for every footer element.

### #3 — Main app sidebar (left nav) cannot be collapsed
- **Where**: the dark navy left navigation panel containing Nomation logo / theme toggle / Dashboard / Projects / USER SETTINGS / Profile / Notifications / Robert / Logout. Visible on every authenticated page. Component is the main app shell layout; likely `frontend/src/components/layout/Sidebar.tsx` or similar (to be confirmed during plan-write).
- **What**: there is no collapse, hamburger, or toggle control on the sidebar. It permanently occupies ~15% of the viewport width on every screen — even when the user is working in a wide, content-heavy panel like the Element Library, Test Builder, or Live Picker.
- **Expected**:
  - Sidebar is **open by default** on first load (preserve current behavior for new users).
  - A toggle control (hamburger button or chevron) lets the user collapse the sidebar to a thin icon-only rail (or hide it entirely — TBD during design).
  - When collapsed, content area expands to fill the freed space.
  - Collapsed/expanded state should persist across navigation within the session and ideally across reloads (localStorage).
- **Severity**: minor → major depending on screen size. On 1920-wide monitors it's tolerable. On 1366-wide laptops the element library is noticeably cramped. The user explicitly flagged it.
- **Evidence**: `left-sidebar.png` shows the always-open sidebar with no toggle control.

### #4 — Test row action buttons are visually misaligned and inconsistent
- **Where**: Tests list page (`/projects/:id/tests`). Each test row's right-side action group: Edit / Run / 🎬 / View Results / Delete. Component is the test list item — likely `frontend/src/pages/projects/.../TestsListPage.tsx` or a `TestRow` component (to be confirmed during plan-write).
- **What**:
  - **Vertical baselines differ**: "Run" sits at a different baseline from Edit / View Results / Delete; the 🎬 emoji's intrinsic line-height pushes its row slot off-baseline as well.
  - **Inconsistent visual treatment**: Edit / View Results / Delete render as colored text links (cyan / magenta / red). Run is plain disabled-looking text with no button styling. 🎬 is a bare emoji icon with no label and no tooltip — unclear what it does.
  - **Uneven horizontal spacing**: gap before/after the 🎬 slot is visibly different from the Edit↔Run gap and Results↔Delete gap.
- **Expected**:
  - All five actions render with the same component shape (text-link OR icon-button — pick one and apply consistently).
  - All centered on a single baseline (`align-items: center` on the flex container).
  - Equal gap between every action (`gap-X` Tailwind utility).
  - The 🎬 button has a `title` / `aria-label` so the user (and screen readers) know what it does. Confirm during plan-write what 🎬 actually does — likely "View recording" / "Play video" — and label it accordingly. If it has the same behavior as View Results, consider merging.
- **Severity**: minor — purely visual, doesn't block any flow, but looks unfinished and the unlabeled emoji is a real accessibility / discoverability issue.
- **Evidence**: `test-buttons-misaligned.png`.

### #5 — One Run button on Tests list, headed/headless picker, drop the 🎬 icon
- **Where**: Tests list (`/projects/:id/tests`) — frontend `TestsPage.tsx:339-372`. Backend `execution-queue.processor.ts:80-100`. The HEADED path already exists in the Test Builder — `TestBuilderPanel.tsx:612 startNormalExecution()`, behind the Test Builder's "Run Test" button + Normal/Debug mode modal. **That same path is what the Tests list must reuse for headed execution.**
- **What today**: Tests list has TWO buttons. Green "Run" queues a headless run with no live progress modal. 🎬 also queues a headless run (priority 10) but opens the LiveExecutionViewer for streamed screenshots. The Test Builder already has a Normal-Mode flow that runs the test in a **real headed browser, watching it execute automatically** (no debug step-by-step). The Tests list page does NOT currently have access to that headed path.
- **Expected**:
  - ONE "Run" button per test row in the Tests list. **Remove the 🎬 button entirely.**
  - On click → popup: **Headed** or **Headless**.
  - **Headed** → reuse the Test Builder's `startNormalExecution` path. A real Chromium window opens on the host, the test executes inside it automatically (no debug stepping), watching the browser is the point. Same UX the user already gets when running a test from inside the test builder. Video recorded. Progress modal shows step-by-step status alongside.
  - **Headless** → current queue path. No browser window. Same video recording, same progress modal, same step status streamed via Socket.IO. Must produce a working video and a usable progress bar end-to-end.
  - Same progress modal/viewer for both modes; only the visible-browser part differs.
- **Implementation shape**:
  - Frontend: Tests list's `handleRunTest` → opens a `RunModePickerModal`. On "Headed" → call into the existing Test Builder Normal-Mode execution path (extract that into a reusable hook/service so it's not locked inside `TestBuilderPanel`). On "Headless" → existing queue-priority path with the LiveExecutionViewer modal opened automatically (so the user always sees progress and the video at the end).
  - Backend: no NEW headed path needed — the Test Builder's Normal Mode already runs headed via the live browser session infrastructure. Just expose/reuse it. The headless queue path stays as-is and must keep recording video + emitting Socket.IO step events for the progress bar.
  - Drop the `/run-live` endpoint after consolidation OR repurpose it for the headed path; decide during plan-write.
- **Severity**: major — kills confusing dual-button UX, kills the unlabeled 🎬, and exposes the existing headed-execution capability from one more entry point.
- **User priority signal**: explicitly flagged as anger-inducing ("makes me angry when I am seeing it"). High emotional priority.

### #6 — Test Builder layout is visually messy / unaesthetic
- **Where**: Test Builder edit page (`/projects/:id/tests/:testId/edit`). Component: `frontend/src/components/test-builder/TestBuilderPanel.tsx` and the page that wraps it.
- **What**:
  - **Save Test button is detached and floats at the bottom-right** as an orange "Unsaved Changes" notification-style bar, separated from the Test Steps panel it saves. The most important action on the page is visually disconnected from the panel it acts on.
  - **Buttons scattered across columns**: "Edit Config" alone at top-right of the middle column; "Templates / Run Test / Clear All" at top-right of the right column. Two separate header bars at different baselines.
  - **Vertical rhythm is broken**: page title "test", then a wide column header (Elements 50 of 295), then the Test Steps header inside the right panel — three different vertical baselines instead of one unified header strip across the page width.
  - The test name "test" sits orphaned at the top-left; the right side at that baseline is empty.
- **Expected**:
  - One unified top header strip across the whole page: test name on the left, primary actions on the right (Save Test / Cancel / Run Test). Save Test moves OUT of the floating bottom banner and INTO the header (sticky if needed). Unsaved-changes state is communicated by button styling (e.g. orange Save button + "1 unsaved step" label) instead of a separate floating bar.
  - Edit Config either becomes a small icon button in the unified header, or moves into the test-steps panel (since it's about the test config).
  - Templates / Clear All stay anchored to the Test Steps panel header (they belong there).
  - Element Library and Test Steps panels use **identical header heights** so their column tops align cleanly.
- **Severity**: minor → major UX. The user used the word "unethical" — strong feel-bad signal. Layout work should be paired with the existing dark-mode pass to ensure visual consistency.
- **Evidence**: `test-builder-edit.png`.

### #6b — Element Library paginated-page-list bug also affects Test Builder
- **Where**: Test Builder edit page → middle Element Library panel. Same component as project Elements tab: `frontend/src/components/test-builder/ElementLibraryPanel.tsx`.
- **What**: Confirmed — Test Builder shows only "Page 38" and "TTS 12" in its element-library page sidebar. Same root cause as **issue #1** (page list computed from currently-loaded paginated subset, not the project's full URL set).
- **Resolution**: fixing issue #1 fixes this too. Just verify the fix lands in both contexts.

### #7 — Remove the Templates feature from the Test Builder
- **Where**: Test Builder edit page → "Templates" button at the top of the Test Steps panel.
- **What**: The Templates feature (the purple "Templates" button + the modal that lets you insert pre-canned test steps) is being deprecated in favor of an upcoming AI test-creation flow. User wants it gone now to keep the UI clean.
- **Files to delete / change** (purely frontend — backend has no test-step-template code):
  - Delete: `frontend/src/components/test-builder/TemplateModal.tsx` (147 lines).
  - Edit `frontend/src/components/test-builder/TestBuilderPanel.tsx`:
    - Remove the `showTemplateModal` state.
    - Remove the "Templates" button (around line 793).
    - Remove the modal render (whichever block invokes `<TemplateModal>` — confirm during plan-write).
    - Remove the `import` for TemplateModal.
- **Severity**: minor — pure cleanup, no functional regressions (Templates is optional UX, AI test creation will replace it).
- **Note**: do NOT touch the unrelated backend "templates" hits — those are `auth-flow-templates`, `public-templates.controller`, and the reporting `execution-report.hbs` Handlebars template. None are this feature.

### #8 — Table elements are unusable: cell click is a dead-end
- **Where**: Test Builder edit page → Element Library → Tables group → table preview / Table Explorer. Components: `frontend/src/components/elements/TableExplorer.tsx`, `frontend/src/components/elements/CellSelectorPopover.tsx`, and the wrapper card `TablePreviewCard.tsx`.
- **What** (verified by interaction in browser):
  - Element library detects tables correctly (project "tts" has the dashboard data table at `table.min-w-full.divide-y`, 1 row).
  - Clicking the table card opens "Table Explorer" with the full data preview — header columns + row values, with a hint "Click cells to add test steps".
  - Clicking a cell **highlights the cell visually** (blue/teal background).
  - **BUT**: no `CellSelectorPopover` appears, no step gets added to Test Steps, and the right "Selected element" panel still shows the WHOLE table selector rather than a cell-specific one. The cell click is a dead-end.
  - The whole-table dropdown only offers generic element actions (Click Element, Double Click, Hover, Type Text, Assert Text on the `<table>`) — none of which are useful for asserting an individual cell value or row count.
  - Per existing project memories `project_table_cell_actions.md` and `feedback_table_data_needs.md`, the intended flow is: cell click → popover with assert/click options → instant step add. The popover and instant-add are NOT firing in the current build.
- **Expected**:
  - Clicking a cell shows `CellSelectorPopover` anchored to the cell, with at minimum: Assert Contains "<cell text>", Assert Equals "<cell text>", Assert Visible, Click Cell, plus Edit/Delete-button-inside-cell shortcuts when those exist.
  - On click, an "Assert Contains <cell text>" step is added immediately to Test Steps (per the 2026-02-18 plan), and the popover stays for choosing alternatives.
  - Each generated step uses a cell-specific selector (e.g. `getByRole('cell', { name: '111AD111' })` or `table.min-w-full.divide-y >> tbody >> tr:nth-child(1) >> td:nth-child(2)`), NOT the whole-table selector.
  - The whole-table dropdown should additionally offer table-level assertions: "Assert row count = N", "Assert column count = N", "Assert table is empty / not empty".
- **Likely root cause** (to verify during plan-write):
  - Either `TableExplorer` is not wiring a click handler on cells, OR the `onAddStep` / `setActiveCell` plumbing is broken (per the 2026-02-18 handoff, the one missing edit was: "in handleCellClick (line ~41), add an immediate `onAddStep()` call before `setActiveCell()`"). It's plausible that change never landed in the current build.
- **Severity**: blocker — user explicitly said "I cannot" use the table. Tables are a key data-driven testing feature.
- **Evidence**: `table-element.png`, `table-explore.png`, `table-cell-after-click.png`.

### #9 — Expanding a table in the Element Library breaks the whole page layout
- **Where**: Test Builder edit page → Element Library → click a Table element to expand `TableExplorer`. Components: `frontend/src/components/elements/TableExplorer.tsx`, `TablePreviewCard.tsx`. The container is the middle column of the test builder (the Element Library panel).
- **What** (verified in browser):
  - When the table preview is expanded inline, the rendered `<table>` is wider than the column. The column expands to fit the table.
  - That cascade widens the whole page → a **horizontal scrollbar appears at the bottom of the viewport**.
  - The right panel (Test Steps + Save Test + Cancel) gets pushed off-screen on the right; "Templates / Run Test / Clear All" buttons clip at the viewport edge; the CLICK step's selector text is truncated mid-string; the "Cancel" button below is cut off entirely.
  - The page title row ("test" + Edit Config) scrolls out of view.
  - In addition, the table preview itself ALSO has its own internal horizontal scrollbar — so we get TWO horizontal scrollbars stacked, both ugly.
- **Expected** (user's stated solution):
  - **Move table interaction into a modal popup**. Clicking a table element opens a centered modal with the full Table Explorer (all columns visible without inner scrollbar, or with a single sane scrollbar inside the modal body). The Test Builder's three-column layout (left sidebar / Element Library / Test Steps) stays untouched in the background.
  - The modal is the single place where the user clicks cells to add steps (#8 popover/auto-step flow happens inside this modal).
  - Closing the modal returns the user to the unmodified test builder layout.
- **Why this is the right shape**:
  - Tables are wide by nature; trying to inline them in a 33%-width column will always either truncate or blow out the layout.
  - A modal naturally gives the user enough horizontal real estate to see all columns at once.
  - It cleanly separates "browsing elements" (current panel) from "exploring tabular data" (focused task).
- **Implementation shape** (to confirm during plan-write):
  - Replace the inline-expand behavior in `TablePreviewCard` with an "Open Table Explorer" button that opens a `<TableExplorerModal>` rendered at the page root (portal). The modal hosts the existing `TableExplorer` content + `CellSelectorPopover` flow from issue #8.
  - The current Tables-group accordion remains for previewing the **list** of tables, but the explorer itself moves to the modal.
  - Add `max-width` / `overflow-x-auto` constraints on the Element Library column as defense in depth so no future widget can force the page to scroll horizontally.
- **Severity**: major — when the user has tables in their project (which is most data-driven tests), the test builder becomes uncomfortable to use the moment they touch one.
- **Evidence**: `table-layout-broken.png` (page scrollbar + cut-off right panel after expanding the table preview).
- **Bundles with**: issue #8 (the cell-click dead-end). Both fixes should land together — once the table moves to a modal, that modal hosts the cell-click → `CellSelectorPopover` → auto-step flow that's currently broken.

### #10 — Action-column buttons inside table cells are not detected
- **Where**: Element detection pipeline. Files involved: `backend/src/ai/element-detection.service.ts` (button detector + table cell extractor), `frontend/src/components/elements/TableExplorer.tsx` and `TablePreviewCard.tsx` (presentation). Reference: existing memory `project_table_cell_actions.md`.
- **What** (verified by comparing the live TTS dashboard against Nomation's analyzed data):
  - **Real site (`tts.am/dashboard`)**: the Registrations table has an "Actions" column. Each row has TWO icon-only buttons inside that cell — a blue edit pencil and a red delete trash.
  - **Nomation captured data**:
    - The 13-column row data for `111AD111` ends with the Actions cell rendered as a literal `-`. The cell text extractor is taking only `textContent`; since the buttons have no visible text (only SVG icons) the cell appears empty and falls through to the "-" placeholder.
    - The element library's Buttons group (7 entries on TTS / dashboard) contains the language switcher, Refresh Rates, etc. — NOT the per-row edit/delete buttons. The row's action buttons were never extracted as standalone library elements.
  - Net effect: a user cannot write any test that interacts with row-level Edit / Delete actions, even though those are usually the most important things to test on a data grid.
- **Expected**:
  - Element detection MUST traverse INTO each `<td>` and capture interactive children (`button`, `a`, role=button, role=link) as their own elements with `tableRow` / `tableColumn` / `cellSelector` metadata.
  - These elements show up in the library Buttons (or Links) group, with descriptions like "Edit (row 1, Truck Number 111AD111)" or "Delete (row 1)" that include enough row context to disambiguate.
  - Selectors must target the row+column precisely (e.g. `tr:has-text("111AD111") >> button[title="Edit"]` or `getByRole('row', { name: '111AD111' }).getByRole('button').first()`).
  - In the Table Explorer, the Actions cell renders the actual buttons (clickable inline) instead of a `-` placeholder. Clicking them adds an "Click <Edit/Delete> on row X" step.
- **Likely root cause** (to verify during plan-write):
  - Per memory `project_element_detection_gaps.md`, button detection was tightened to skip `<tr>`/`<td>`/`<th>`/`<li>` with `cursor:pointer` to fix false positives. That filter likely also drops legitimate `<button>` children INSIDE table cells. Need to refine: skip the cell wrapper itself, but still descend into and capture interactive children.
  - The cell text extraction logic in `TableExplorer` / table-data builder uses `cell.textContent.trim() || '-'`. Needs to additionally surface child button info (icons / aria-labels / titles) so the explorer can render them.
- **Severity**: blocker for any data-grid test scenario. User explicitly flagged: "they are not being saved and etc... I don't see them in table."
- **Evidence**: tab 1 of browser session shows live TTS dashboard with edit/delete icons in Actions; tab 0 (Nomation) Table Explorer shows the same row's Actions cell as `-` and no per-row buttons in the Buttons (7) group.
- **Bundles with**: #8 and #9 — the modal table explorer must show these inline-cell buttons clickable. Detection fix is backend; presentation fix is frontend; both need to land together.

### #11 — Add a library of "template action" steps to skip popup/wait/dialog wiring
- **Where**: Test step type catalog and step-add UI (Test Builder edit page → step type combobox at `frontend/src/components/test-builder/TestBuilderPanel.tsx` step-add area). Backend executor: `backend/src/execution/step-executor.service.ts` (the canonical place per memory `project_step_executor.md`). Memory implications: any new step type must be implemented in the StepExecutorService so both engines (queue + live) handle it.
- **What today**: Step type combobox offers low-level primitives only — Click, Double Click, Hover, Type Text, Press Key, Wait, Assert Text, etc. Common test friction patterns (cookie banners, confirm dialogs, "wait until spinner gone") have to be wired manually as a sequence of 3–6 primitive steps. User wants high-level template steps that handle these at the runtime so the test author can stay focused on the business flow. Note: this is **runtime template actions** — totally different from issue #7 (the Templates BUTTON / TemplateModal which inserts pre-canned step sequences statically; that one is being deleted).
- **Expected — proposed catalog of template actions** (group in the combobox under a "Common Actions" section):

  **Dialog & popup**
  - Confirm popup — find the most recently shown app-level confirmation popup and click its primary action (OK / Yes / Confirm).
  - Cancel popup — find the most recently shown app-level confirmation popup and click its secondary action (Cancel / No).
  - Accept browser alert — `page.on('dialog', d => d.accept())` for native `alert/confirm/prompt`.
  - Dismiss browser alert — `page.on('dialog', d => d.dismiss())`.

  **Cookie / consent**
  - Accept cookies banner — find a visible "Accept" / "Agree" / "Allow all" inside a known consent-banner shape and click.
  - Dismiss cookie banner — find Reject / Decline / Close.

  **Modals**
  - Close modal — press Escape OR click the modal's close button (`[aria-label*="close" i]`, `button:has-text("×")`).
  - Click outside modal — click at viewport corner outside the modal element.

  **Async waits**
  - Wait for spinner to stop — wait for absence of common spinner selectors (`[role="progressbar"]`, `.spinner`, `.loading`, etc.) with a timeout.
  - Wait for element to appear — selector + timeout.
  - Wait for element to disappear — selector + timeout.
  - Wait for toast — selector tuned to known toast/snackbar containers.
  - Wait for network idle — Playwright `waitForLoadState('networkidle')`.

  **Toast / notification**
  - Dismiss toast — click toast's close icon or wait for auto-fade.
  - Assert toast contains — substring match on the toast text.

  **Navigation**
  - Wait for navigation — wait for URL to change after the previous step.
  - Go back / Go forward — `page.goBack()` / `page.goForward()`.
  - Reload page — `page.reload()`.

  **Forms**
  - Submit form — press Enter on the focused/given field.
  - Clear all form fields — clear all `input` / `textarea` inside a target form.
  - Pick first option / Pick random option / Pick last option — for `<select>` and combobox-style dropdowns.

  **Auth shortcuts** (reuse configured project AuthFlow)
  - Login — run the project's stored auth flow start-to-end.
  - Logout — find logout link/button by common patterns and click.

  **File upload**
  - Upload file from path — use `page.setInputFiles()`.

  **Tabs / iframes**
  - Switch to new tab — bind to the most recently opened tab.
  - Switch to main tab — go back to original tab.
  - Switch into iframe — by index, selector, or name.
  - Exit iframe — return to main frame.

  **Scrolling**
  - Scroll element into view.
  - Scroll to top / Scroll to bottom of page.

- **Implementation shape** (to confirm during plan-write):
  - Add a new step type discriminator (e.g. `type: 'template'` with a `templateAction: 'confirm-popup' | 'wait-for-spinner' | …`) on `TestStep`.
  - Implement each template handler in `step-executor.service.ts` so both queue and live engines pick them up automatically (per memory `project_step_executor.md`).
  - In the Test Builder step-add UI, group the new types under a "Common Actions" subsection in the combobox — DO NOT mix them with the low-level primitives so the catalog stays scannable.
  - Each template gets per-template config UI (e.g. "Wait for spinner" needs an optional max-timeout; "Switch into iframe" needs the index/selector).
  - Selectors for popup/banner/spinner discovery should be configurable per project (in project settings: optional overrides for "confirm button selector", "cookie banner selector", "spinner selector"). Default to a sane multi-pattern catch-all.
- **Severity**: feature, but high value — it's the difference between "every test has 6 boilerplate steps before the actual flow" and "every test starts at the actual flow". Likely deserves its own multi-week sprint after the bug-fix sprint from this walkthrough.
- **Note**: keep this orthogonal to the future AI test creation (issue #7's replacement). AI generation can EMIT these template steps; they don't conflict.

### #12 — Live Picker does not persist picked elements to the library (REGRESSION from this morning's Fix 3)
- **Where**: `frontend/src/components/element-picker/LiveElementPicker.tsx` (rewritten this morning, commit `bf8809a`). Consumers: `frontend/src/pages/tests/TestBuilderPage.tsx:402-419` and `frontend/src/components/test-builder/ElementLibrarySidebar.tsx:141-147`.
- **What** (verified by reading the code path):
  - The rewritten picker calls `onSelectElement(selector, description)` — just two strings, no full element data, no backend persistence call.
  - `TestBuilderPage` consumer (line 411): the `onSelectElement` handler logs to console and pops a success toast saying `"<description> added to library"`. **It does not call any API.** The toast is misleading.
  - `ElementLibrarySidebar` consumer (line 128): `handleElementsSelected` expects `(newElements: ProjectElement[]) => void`, but my rewritten picker never invokes `onElementsSelected` and never produces a `ProjectElement[]`. Dead wire.
  - Net effect: clicking "Save to Library" in the Live Picker closes the modal, shows a fake-success toast, **persists nothing**, and the element library shows zero new elements.
- **Expected**:
  - Clicking "Save to Library" calls `projectsAPI.createElements(projectId, [pickedElement])` (or equivalent), passing full element data: `selector`, `elementType`, `description`, plus optional attributes, region label, source URL of the captured page.
  - On success, the new element appears in the Element Library immediately, grouped under the correct page bucket (the URL of the page that was captured at the time of the pick) and the correct type bucket (button / link / input / etc.). This means the saved element's `sourceUrl` must point at a real `ProjectUrl` row — if the URL isn't yet a `ProjectUrl`, either (a) refuse the save with a clear error, or (b) auto-add the URL as a manual one and link the element to it. Decide during plan-write.
  - Toast on success reads `"<description> added"` only AFTER the API call returns 2xx. On failure show the actual error.
- **Implementation shape** (to confirm during plan-write):
  - Extend the `PickedElement` shape inside `LiveElementPicker` to carry everything the backend needs: `selector`, `elementType`, `description`, `attributes`, `tagName`, `textPreview`, `capturedAtUrl`.
  - Replace `onSelectElement?(selector, description)` with `onElementSaved?(saved: ProjectElement)` (or call the API directly inside the picker after the user clicks Save, then notify).
  - In `handleSaveElement`, call `projectsAPI.createElements(projectId, [...])` then notify the consumer with the full saved element so it can refresh the library list.
  - Both consumers need updating (`TestBuilderPage`, `ElementLibrarySidebar`) to refresh their element list / call `loadProjectAndTests()` / equivalent after the save.
- **Severity**: blocker — Live Picker is the headline feature for picking elements that the analyzer missed; right now it does NOTHING and lies about it. Compounds with issues #1, #6b (the library page-list bug) and #2 (shared elements grouping) — when this is fixed, the saved element must land in the correct page+type bucket per #1's full-page-list fix and #2's region-aware grouping.
- **Pairs with the existing memory entry** `project_live_picker_dom_render.md` — that memory documents the iframe-snapshot picker. Update it when this is fixed to note that Save-to-Library actually persists.
- **Apology**: my rewrite this morning shipped without verifying the Save flow end-to-end. The plan said "save selected element via existing onSelectElement"; I left that callback as a string-only stub but neither consumer was wired to persist. Verification gap on my side.

### #12b — Live Picker must support multi-element capture in one session
- **Where**: same component as #12 (`frontend/src/components/element-picker/LiveElementPicker.tsx`).
- **What today**: `handleSaveElement` calls `onClose()` immediately after the (broken, see #12) save call. Even once #12 is fixed and persistence works, the modal still closes after a SINGLE pick. User has to reopen the picker, restart the browser session, recapture the page, etc. for every additional element.
- **Expected**:
  - After clicking "Save to Library" the picker **does NOT close**. The success goes into a toast / "Saved" badge inside the picker; the iframe stays loaded; the user can immediately click another element on the same captured page.
  - User can also click "Recapture" after navigating in the headed browser, then keep picking more elements from the new page.
  - A small running counter visible in the picker header — e.g. `Saved this session: 3` — so the user can tell something is happening.
  - A "Done" button replaces the current "Save → close" semantics. Clicking Done closes the picker. Closing via `×` / Escape also works without confirmation (saves are already persisted per-pick).
  - Each saved element lands in the library immediately so the user can verify their picks alongside in the underlying test builder if they want.
- **Implementation shape**:
  - In `handleSaveElement`, after the API call resolves, do NOT call `onClose()`. Instead: clear `picked` state, increment a session counter, show inline confirmation (toast or badge).
  - Keep the iframe document and listeners intact across saves — already correct in my rewrite (iframe is only re-rendered on Recapture).
  - The selected-element side panel should clear back to its empty state so the user knows they can pick again.
- **Severity**: major — without this, even with #12 fixed the picker is still painful: every new element = full-session restart.
- **Bundles with**: #12 (the persistence fix). Both land together as the Live-Picker overhaul.

---

## Pre-walkthrough sanity check
- App reachable at `http://localhost:3001` ✓
- Backend reachable at `http://localhost:3002` ✓
- Landing page renders cleanly
- Pre-login console noise: 401s from `ProjectsContext` firing on the landing page even without auth — minor, not the user's reported issues but worth noting (`frontend/src/contexts/ProjectsContext.tsx`)
