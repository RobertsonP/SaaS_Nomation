# 9-Bug Fix Sprint
Date: 2026-02-21

## Plan
- [+] Bug 1+2+3: Fix infinite re-render (useRef for callbacks) — CRITICAL
- [+] Bug 9: Browser stealth + HTTP status check + localhost translation
- [+] Bug 6: maxPages enforcement in discovery
- [+] Bug 7: Floating indicator always visible when discovery active
- [+] Bug 5: Modal closes on discover, blocked during active discovery
- [+] Bug 4: Progress bar on floating indicator + delete dead code
- [+] Bug 8: Dropdown onAddStep for test builder

## What Happened
All 9 bugs fixed (7 tasks, bugs 1-3 bundled). TS compiles clean on both frontend and backend.

### Summary of changes:
1. **useAnalysisProgress.ts + useDiscoveryProgress.ts**: Stored `onComplete`/`onError` in `useRef` — breaks the infinite re-render loop
2. **browser-manager.service.ts**: Added `--disable-blink-features=AutomationControlled`, realistic UA/viewport/locale on all contexts, `navigator.webdriver=false` override, HTTP status checking (rejects 403/404 error pages)
3. **page-crawler.service.ts**: Same stealth args + webdriver override for crawler browser
4. **project-analysis.service.ts**: Added `normalizeUrlForDocker()` for localhost URLs, don't mark URLs as `analyzed: true` on HTTP errors
5. **discovery.service.ts**: Pass `maxPages - discoveredPages.length` to crawler, enforce cap after merge, fix progress callback
6. **DiscoveryFloatingIndicator (discovery/)**: Removed `isMinimized` gate — shows whenever `activeDiscovery` is not null. Added animated progress bar.
7. **DiscoveryContext.tsx**: Removed `setIsMinimized(false)` from `startBackgroundDiscovery`
8. **DiscoveryModal.tsx**: Removed in-modal progress display, calls `onClose()` instead of `onMinimize()` on discover start
9. **ProjectDetailsPage.tsx**: Blocks discovery modal from opening during active discovery, removed dead indicator component usage
10. **DropdownPreviewCard.tsx**: Added `onAddStep` prop with "+" button per option to create test steps
11. **ElementLibraryPanel.tsx**: Passes `onAddStep` to `DropdownPreviewCard`
12. **Deleted**: `components/sitemap/DiscoveryFloatingIndicator.tsx` (dead code)
