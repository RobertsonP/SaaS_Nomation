---
name: nomation-bugs
description: Known bugs, issues, and technical debt in Nomation. Check this skill before making any changes to verify you're not reintroducing a known issue. Check after making changes to see if your fix addresses a listed bug. Update this skill when bugs are found or fixed by moving entries between sections.
---

# Known Bugs and Technical Debt

## CRITICAL (blocks user workflows)

### BUG-001: Test results pages crash — missing components
Location: frontend/src/pages/tests/TestResultsPage.tsx, SuiteResultsPage.tsx
Cause: Import components/test-results/RobotFrameworkResults and RobotFrameworkSuiteResults — these files and directory DON'T EXIST
Impact: Users cannot view any test execution results
Fix: Create components/test-results/ directory with both components

### BUG-003: Two execution engines with different behavior
Location: execution.service.ts (direct) vs execution-queue.processor.ts (queue)
Cause: Two implementations evolved independently
Impact: Same test gives different results from different UI buttons
Fix: Unify into one path or ensure both are identical

## HIGH (degrades experience significantly)

### BUG-004: WebSocket CORS hardcoded to localhost
Files: analysis-progress.gateway.ts:64, discovery-progress.gateway.ts:25, execution.gateway.ts:30
Fix: Change to process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001']

### BUG-005: Element detection misses React/Vue/Angular interactive components
Location: element-detection.service.ts early exit filter lines 349-361
Cause: Checks inline style cursor only, not computedStyle. React onClick not in HTML onclick attribute.
Fix: Check computedStyle.cursor before early exit. Detect __reactFiber$ and __reactProps$ properties.

### BUG-006: Duplicate buttons get non-unique or rejected selectors
Location: element-detection.service.ts selector generation
Cause: Identical buttons (e.g. "Add to Cart" x5) — every selector matches all 5. nth-child rejected by quality filter.
Fix: Context-aware selectors using parent content to disambiguate

### BUG-007: Crawler over-fetches content pages
Location: discovery.service.ts crawl loop, link-discovery.service.ts
Cause: Follows ALL <a href> links including individual content items
Fix: Prioritize navigation/structural links, limit content page crawling depth

## MEDIUM (workaround exists)

### BUG-008: SmartWaitService not connected to direct execution
Location: execution.service.ts doesn't use SmartWaitService
Fix: Import and use for element waits and page navigation

### BUG-009: Non-functional placeholder buttons visible to users
Location: ElementCard.tsx (4 TODO buttons), SelectedElementsList.tsx (validate), ProfileSettingsPage.tsx (upgrade)
Fix: Either implement or hide

### BUG-010: Interactive element discovery disabled in master
Location: element-analyzer.service.ts lines 44-46
Impact: Modals, dropdowns, tabs not scanned during page analysis
Fix: Add "Deep Scan" option that enables interactive discovery

## FIXED (reference for what was resolved)

### BUG-002: Live test builder only supports 3 of 14 actions — FIXED 2026-04-10
Fix: Added all 16 action types to live-browser.service.ts executeAction() switch statement. Also removed the two frontend switch statements in TestBuilderPanel.tsx that were collapsing action types down to click/hover/type before sending to the backend.
