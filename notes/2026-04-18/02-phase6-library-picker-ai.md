# Phase 6: Element Library + Display Fix + Live Picker + AI Test Generation
Date: 2026-04-18

## Plan
- [+] 6A.1: Fix CSS preview text cut-off (CSSPreviewRenderer compact mode)
- [+] 6A.2: Add real background colors to element previews
- [+] 6B: Element library tree view restructure (pages left, type-grouped right)
- [+] 6C: Live picker capture-on-demand redesign
- [+] 6D: Claude AI test generation service + Playwright file generator

## What Happened

### 6A.1: CSS Preview Text Cut-Off Fixed
- CSSPreviewRenderer.tsx compact mode: maxWidth 120px→100%, whiteSpace nowrap→normal, removed textOverflow ellipsis, maxHeight 32px→auto
- Overflow changed to visible in compact mode

### 6A.2: Real Background Colors
- ElementPreviewCard.tsx: preview container uses element.attributes.resolvedColors.backgroundColor
- ElementCard.tsx: same real background color treatment
- Elements now show with their actual website appearance (blue button on dark bg → blue on dark)

### 6B: Element Library Tree View
- Left panel (30%): scrollable page list with element counts, clickable, selected highlighted blue
- Right panel (70%): elements grouped by type in collapsible accordion sections
- Type sections: Buttons, Inputs, Links, Forms, Tables, Headings, Dropdowns, Navigation, Text
- Removed type filter chips (redundant with type sections)
- Auto-selects first page when data loads
- Preserved: pagination, search, special card renderers, all callbacks

### 6C: Live Picker Capture-on-Demand
- Backend: new capturePageState() method + GET /sessions/:token/capture endpoint
- Returns ONE screenshot + ALL detected elements + URL + title
- Frontend: complete rewrite of LiveElementPicker
  - Removed ALL screenshot polling (no setInterval)
  - Removed "Click & Capture" mode entirely — NO clicking on real page
  - New flow: "Browser is Open" → "Capture Page" button → screenshot + elements displayed
  - Click on screenshot → match to element by bounding rect
  - "Save to Library" button for selected element
  - "Capture Again" for subsequent captures
  - Element list sidebar showing all detected elements

### 6D: Claude AI Test Generation
- Installed @anthropic-ai/sdk
- Created ClaudeAiService: 5 category generators (auth, navigation, forms, tables, e2e)
  - Each sends focused context with REAL selectors from element library
  - System prompt enforces: only use provided selectors, every test has assertions
  - Expected output: 46-66 comprehensive tests per project
- Created TestGenerationService: builds project context from DB, calls Claude, validates selectors, stores tests as drafts, generates Playwright .spec.ts files
- Created Playwright file generator: converts tests to real runnable .spec.ts code
- API: POST /projects/:id/tests/generate (with OrganizationGuard)
- Frontend: "Generate Test Suite with AI" button on project overview page, confirmation modal, loading state, success notification

## Verification
- npx tsc --noEmit passes in both backend/ and frontend/
- All changes surgical
- Dark mode on all new UI elements
