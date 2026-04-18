# Phase 4: Test Builder UX Overhaul
Date: 2026-04-13

## Plan
- [+] 1a: Remove embedded browser preview from test builder
- [+] 1b: Add execution mode popup (Normal vs Debug)
- [+] 1c: Fix browser viewport size (1280x720 for live sessions)
- [+] 1d: Fix start URL — session creation now navigates immediately
- [+] 1e/1f: Table cell action buttons (detect Edit/Delete in cells)
- [+] 2: Live picker — fixed session cleanup (stale closure bug)
- [+] 3: Live picker button already separate (confirmed in code)
- [+] 4: Session cleanup — close on unmount, reduced timeout to 15min, close existing before new
- [+] 5: Element library display overhaul (heights, truncation, layout)

## What Happened

### Backend Changes

**live-browser.service.ts:**
- `createSession()` now accepts `startUrl` param — navigates immediately on creation
- Viewport changed from 1920x1080 to 1280x720 for live sessions
- Session timeout reduced from 2 hours to 15 minutes
- Added `closeAllProjectSessions()` — closes existing sessions before creating new one
- `extendSession()` also uses 15-minute extension

**browser.controller.ts + public-browser.controller.ts:**
- POST /api/browser/sessions now accepts `startUrl` in body

**element-detection.service.ts:**
- Table detection now captures `cellActions` — buttons/links inside each cell
- Each action has: text, selector (row+cell+tag scoped), tag name
- Stored in `tableData.cellActions[row][col]` alongside `cellSelectors`

### Frontend Changes

**TestBuilderPanel.tsx:**
- Removed `LiveSessionBrowser` embedded preview (redundant with headed browser)
- Added execution mode modal: Normal (runs all automatically) vs Debug (step-by-step)
- Debug mode: shows current step info, "Next Step" button, pass/fail result per step
- Debug panel with orange theme, dark mode support
- "Execute All Steps" button renamed to "Run Test" → opens mode selection
- Added session cleanup on component unmount
- Modal width reduced from max-w-7xl to max-w-2xl

**ElementPreviewCard.tsx:**
- Screenshot max-height: 96px → 160px
- CSS preview max-height: 80px → 128px
- Description: 2 lines → 3 lines
- Selector: removed 40-char truncation, shows full with break-all
- Native locators formatted as badge + readable value

**ElementCard.tsx:**
- Description: 2 lines → 3 lines
- Selector limits: native 47→80 chars, CSS 40→60 chars
- Native locators formatted as readable badge + extracted value

**ElementVisualPreview.tsx:**
- Preview max-height: 80px → 140px

**ElementLibraryPanel.tsx:**
- Grid changed from 2-column to 1-column (list layout, more readable)

**CellSelectorPopover.tsx:**
- Accepts `cellActions` prop
- Shows "Click Edit", "Click Delete" etc. as step options when cell has action buttons

**TableExplorer.tsx:**
- Shows blue dot indicator on cells that contain action buttons
- Passes cellActions to CellSelectorPopover

**LiveElementPicker.tsx:**
- Fixed stale closure bug in cleanup — uses ref instead of state for session token

**api.ts:**
- `createSession()` now accepts and sends `startUrl` parameter

## Verification
- npx tsc --noEmit passes in both backend/ and frontend/
- All changes surgical, no refactoring of surrounding code
- Dark mode classes on all new UI elements
