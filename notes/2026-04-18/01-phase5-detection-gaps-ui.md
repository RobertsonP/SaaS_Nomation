# Phase 5: Element Detection Gaps + UI Fixes
Date: 2026-04-18

## Plan
- [+] Dark mode sweep of TestBuilderPanel.tsx (26 edits, 30+ lines)
- [+] Fix heading detection (h1-h6 now type 'heading' not 'text', added h4-h6 to query)
- [+] Fix form detection (added 'form' to query, bypass size filter for structural elements)
- [+] Fix input detection (operator precedence bug in visibility filter)
- [+] Fix button false positives (skip table/list items, skip wrappers, require text > 1 char)
- [+] Add 'heading' type to frontend (filter chips, badges, icons in 5 files)
- [+] Reduce screenshot polling 500ms → 2000ms
- [+] Pause polling during element detection
- [+] Add animations: 'disabled' to screenshot capture

## What Happened

### Dark Mode — TestBuilderPanel.tsx
26 edits across the file:
- Root container: bg-white + dark:bg-gray-800
- All borders, text colors, backgrounds in main panel, modals, forms, step cards
- Input elements: added dark bg/text/border
- All modal backgrounds (Add Step modal, Sequential execution modal)
- Error states, pending states, footer summary

### Element Detection Gaps Fixed

**Headings (was 100% missing):**
- Added h4, h5, h6 to querySelector (only h1-h3 were queried before)
- Changed getElementType() to return 'heading' instead of 'text' for h1-h6
- Added heading-specific description: "Heading N: [content]"
- Added 'heading' type support in 5 frontend files (filter, badges, icons — cyan theme)

**Forms (was 100% missing):**
- Added 'form' to the optimized querySelector — forms were NEVER queried
- Added form/fieldset to zero-size bypass list in isQuickVisible() — forms are structural containers with no inherent size

**Inputs (was 81% missing):**
- Fixed operator precedence bug in visibility filter: `rect.width === 0 && rect.height === 0 && !element.hasAttribute('type') || element.getAttribute('type') === 'hidden'` had wrong grouping due to `||` precedence. Fixed with parentheses.

**Button false positives (was 52% over-count):**
- Skip table/list items (tr, td, th, li, etc.) with cursor:pointer — these are row selection, not buttons
- Skip wrapper elements containing child interactives (button, a, input) — they're containers
- Tightened text content check from length > 0 to length > 1 — single-char elements are icons

### Browser Blinking Fixed
- Screenshot polling: 500ms → 2000ms
- Polling pauses during element detection (cleared on click, restarted in finally block)
- startScreenshotPolling made idempotent (clears existing interval first)
- Backend: animations: 'disabled' added to page.screenshot() in getSessionScreenshot

## Verification
- npx tsc --noEmit passes in both backend/ and frontend/
- All changes surgical
- Dark mode applied to all new and existing UI in TestBuilderPanel
