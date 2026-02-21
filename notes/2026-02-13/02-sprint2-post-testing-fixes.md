# Sprint 2: Post-Testing Fixes — 6 Issues
Date: 2026-02-13 19:16 (GMT+4)

## Plan

### Phase 1: Fix Error Handling & WebSocket Churn
- [+] Fix GlobalExceptionFilter — only use VALIDATION_ERROR for Array messages (class-validator)
- [+] Delete useProjectWebSocket.ts — merge callbacks into useAnalysisProgress
- [+] Update ProjectDetailsPage — single WebSocket hook, no churn

### Phase 2: Popup Window Detection & Analysis
- [+] Add page.waitForEvent('popup') to tryTrigger() in interactive-element-discovery
- [+] Add extractElementsFromPage() helper for popup window element extraction
- [+] Add 'popup' to discoveryState enum
- [+] Add popup badge (pink) to ElementPreviewCard

### Phase 3: Dropdown Grouping with Option Selectors
- [+] Backend: Generate per-option selectors + CSS in element-detection (dropdownData)
- [+] Add dropdownData interface (backend + frontend types)
- [+] Create DropdownPreviewCard.tsx (following TablePreviewCard pattern)
- [+] Wire into ElementLibraryPanel

### Phase 4: Discovery UX — Progress Modal & Background Task
- [+] Backend: Create DiscoveryProgressGateway (separate namespace /discovery-progress)
- [+] Backend: Wire gateway into discovery.service.ts, emit events during crawl
- [+] Frontend: Create useDiscoveryProgress.ts hook
- [+] Frontend: Update DiscoveryModal — auto-minimize 500ms after discovery starts
- [+] Frontend: Create DiscoveryFloatingIndicator.tsx
- [+] Wire into ProjectDetailsPage

### Phase 5: Non-Docker Localhost Detection
- [+] Connectivity check already existed — improved Docker-specific error messages
- [+] Add --host-resolver-rules to browser launch args in Docker (page-crawler.service.ts)
- [+] Better error message: tells users to bind to 0.0.0.0 when in Docker

### Phase 6: Multi-Auth Flow Analysis (Badges Only)
- [+] Loop ALL auth flows in analyzeProjectPages() instead of authFlows[0]
- [+] Pass authFlowId to storeProjectElements()
- [+] Include authFlow in project findById() query
- [+] Add authFlow to frontend types + amber badge on ElementPreviewCard

## Progress
All 6 phases complete. Both backend and frontend compile clean.

## What Happened
Sprint 2 delivered 6 improvements:
1. Error codes now correct — no more false ERR_1001 on non-validation errors
2. WebSocket consolidated — single connection instead of duplicate churn
3. Popup windows detected and elements extracted with pink badge
4. Dropdowns show per-option selectors with CSS preview (like tables)
5. Discovery now has WebSocket progress + floating indicator (like analysis)
6. Docker localhost resolution improved + better error messages
7. Multi-auth analysis — loops all auth flows, stores authFlowId, shows amber badge
