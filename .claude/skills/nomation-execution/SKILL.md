---
name: nomation-execution
description: How test execution works in Nomation — both execution paths, step types, and known differences. Load when working on test execution, the test builder step handling, or anything related to running tests. Critical for keeping both execution engines consistent.
---

# Test Execution System

## TWO EXECUTION PATHS (this is a known problem — BUG-003)

### Path 1: Direct (execution.service.ts)
- Called from: POST /api/tests/:testId/execute (via tests.controller.ts)
- Features: 16 step types, fallback selectors, WebSocket progress
- Missing: video recording, SmartWaitService, Docker URL normalization
- Navigation: page.goto(url) with NO waitUntil specified for non-auth tests

### Path 2: Queue (execution-queue.processor.ts)
- Called from: POST /api/execution/test/:testId/run (via execution.controller.ts)
- Features: same 16 step types PLUS video recording, SmartWaitService, Docker URL normalization, Playwright getBy* locator support
- This is the MORE COMPLETE implementation

### Path 3: Live Browser (live-browser.service.ts)
- Called from: test builder UI "play" button per step
- Features: ONLY click, hover, type (BUG-002)
- Frontend converts all other actions to these 3 before sending

## All 16 Step Types
click, type, wait, assert, hover, select, check, uncheck, navigate, scroll, press, screenshot, doubleclick, rightclick, clear, upload

## Frontend Step Type Definitions (TestBuilderPanel.tsx)
14 visible to user (screenshot and navigate are not in the dropdown but supported in backend):
click, doubleclick, rightclick, hover, type, clear, select, check, uncheck, upload, scroll, press, wait, assert

## Assert Behavior
Current: locator.textContent() → check if includes step.value
Limitation: Only checks text content containment. Cannot assert:
- Element visibility, element count, attribute values
- Table cell values by row/column
- URL change, page title, element CSS properties

## Fallback Selectors
execution.service.ts has getReliableLocator() that tries primary selector, then each fallbackSelector in order. First one that finds an element wins. This is a good pattern.
