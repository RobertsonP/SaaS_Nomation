# Element library UX pass + Test Builder fixes
Date: 2026-05-11
Branch: `redesign/v2`

## Plan
- [+] Restore CSS-rendered preview fallback in element cards + project table
- [+] Bump compact preview size in project Elements tab table
- [+] Restore page-filter sidebar in test-builder element library
- [+] Add visible "selected" state to element cards + scroll feedback on click
- [+] Replace grab cursor with hover-colour affordance on cards
- [+] Switch scroll target from library scroll container → window
- [+] Persist Edit Config changes (name / description / starting URL)
- [+] Remove bottom "Pick from page" button (Live Picker already in header)
- [+] Fix collapsed sidebar — expand toggle was off-screen at 56px width

## Progress

### `75e63ae` Restore CSS-rendered preview
- The earlier ElementPreviewCard rewrite dropped the `CSSPreviewRenderer` fallback, so any element without a screenshot and not button/input/link only got the dim "type name" placeholder.
- Restored the three-tier preview chain in both `ElementPreviewCard.tsx` and the project Elements tab table preview cell in `ElementLibraryPanel.tsx`:
  1. Real `element.screenshot` if available
  2. `CSSPreviewRenderer` (mode="compact") when `attributes.cssInfo` exists — container background pulls from `resolvedColors.backgroundColor` or `cssInfo.backgroundColor` so the chip blends against the element's actual backdrop
  3. `ElPreview` design chip as last resort
- 72px min-height on the card preview, 52px on the table preview cell.

### `863fad7` Bigger preview in project Elements tab
- `.el-preview-compact` min-height 52 → 76px, padding 8/10 → 10/12, inner btn/input/link sizes bumped.
- Project Elements table preview column width 130 → 160, inner cell wrapper 110 → 140.
- Screenshot and CSS-preview cell wrappers go 52 → 76px with rounded `6` corners.

### `5110bf6` Page-filter sidebar back in test-builder
- User asked for the left page sidebar back in test creation (had been dropped in plan-mode decision earlier).
- Re-enabled the auto-select effect (test-builder mode only — `!isProjectMode` guard).
- Added a 180px page sidebar on `surface-2` with "Pages" caps eyebrow; each page row shows title, mono path, and `{n} elements` counter; active page uses `moss-soft` background + 2px moss left stripe.
- Pseudo-buckets (`SHARED_KEY`, `UNATTRIBUTED_KEY`) work again.
- Project Elements tab still uses the flat table (it has its own Page column).

### `5f0945d` Selected state + scroll-into-view + drop grab cursor
- `ElementPreviewCard` takes a new `selected` prop. When true:
  - Card background → moss-soft, border → moss, box-shadow → shadow-md
  - First implementation: `cardRef.scrollIntoView({block:'start', behavior:'smooth'})` to scroll the card to the top of the library scroll container
- Card cursor changed from 'grab' → 'pointer'. The `GripVertical` icon keeps its 'grab' cursor with `stopPropagation` so clicking it doesn't fire onSelectElement.
- Hover: background → surface-2, border → ink-3.
- `selectedElementId` plumbed through `ElementLibraryPanel` from `TestBuilder.tsx`.

### `16633c4` Scroll the page, not the library
- User reported the scroll-into-view from `5f0945d` was scrolling the wrong target — the library's inner scroll container was moving the just-clicked card out of view.
- Replaced with `window.scrollTo({ top: 0, behavior: 'smooth' })` so the whole page scrolls to top when selection changes. Library scroll position stays put.
- Dropped the now-unused `cardRef` and `useRef` import.

### `971782b` Persist Edit Config + drop bottom Pick from page button
- Bug: clicking "Edit Config" in the test builder header, changing the starting URL, and saving → refresh page → values reverted. Root cause: `handleConfigurationSave` only updated local state, never called the backend.
- Fix: `handleConfigurationSave` is now async. For existing tests (testId + test present), it diffs name/description/startingUrl against `test.*` and calls `testsAPI.update(testId, { name, description, startingUrl, steps: test.steps ?? [] })` to persist. Preserves the steps the backend already has so unsaved step edits in the builder aren't affected.
- Updates local `test` state with the new fields. Toast on success / failure.
- Also removed the bottom "Pick from page" outline strip from the test-builder element library (Live Picker is already in the panel header — the strip was redundant).

### `f98ae60` Collapsed sidebar fix
- Bug: once the sidebar collapsed to 56px width, the expand toggle button was unreachable. Root cause: `.sidebar-head` was a horizontal flex row containing brand-mark (18) + theme btn (24) + collapse btn (24) + paddings (14+12) ≈ 92px of content, way over 56px — the right-most button got pushed off-screen.
- Fix in `verdant.css`: `.app.collapsed .sidebar-head` switches to `flex-direction: column`, hides the `.brand` entirely (the lone 18px square looked orphaned), stacks the icon-buttons vertically with 4px gap. Both buttons now fit comfortably in 56px.

## Verification
- `cd frontend && npx tsc --noEmit` exits 0 after every commit (7 successful checks).
- Manual smoke needed: hard-refresh to bust cached stylesheet + test the sidebar expand from collapsed state.

## What Happened

Today the user iterated through a series of small UX corrections after I shipped the bigger redesign:
1. Restore real-element previews (not just stylised chips) so the user can identify elements from their actual rendered look.
2. Make those previews larger in the project Elements tab — they were too small to be useful at a glance.
3. Bring the page-filter sidebar back in the test builder (user changed mind from earlier "drop the page sidebar" decision).
4. Make element-click feedback obvious — the user couldn't tell if their click had registered. Multiple iterations: first added scrollIntoView + selected state, then user noted the scroll target was wrong (was scrolling the library, should scroll the page).
5. Persist Edit Config to the backend — bug where the modal only updated local state.
6. Drop the redundant bottom "Pick from page" button in the library.
7. Fix the collapsed sidebar — the expand toggle had no room.

All seven landed without TS regressions. Remaining branch state: `redesign/v2` is 35+ commits ahead of `origin/redesign/v2` and ready for Phase 8 (audit + PR) whenever the design iteration settles down.
