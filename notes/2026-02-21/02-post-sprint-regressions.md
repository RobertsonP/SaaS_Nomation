# Post-Sprint Fix: 3 Issues from Testing
Date: 2026-02-21

## Plan
- [+] Step 0: Commit 9-bug fix sprint (clean checkpoint)
- [+] Issue 3: Localhost DNS fix (tiny)
- [+] Issue 2: Screenshots strategy (small-medium)
- [+] Issue 1: Discovery progress modal wired to context (medium)
- [+] TS compile check (both frontend + backend pass)
- [ ] docker compose up --build + manual verification

## Issue 1: Discovery progress not visible
**Root cause:** Two discovery systems don't communicate. Modal uses local hook, floating indicator reads DiscoveryContext.
**Fix:** Wire modal to DiscoveryContext, add minimize/maximize, shared state.

## Issue 2: Screenshots missing
**Root cause:** `--disable-images` flag, crawler only screenshots first 10 pages.
**Fix:** Remove flag, raise to 30 pages, smaller thumbnails (640x360 q30), smart element screenshots.

## Issue 3: Localhost can't be analyzed
**Root cause:** Analyzer browser missing DNS hint for host.docker.internal + isLocalAddress() doesn't recognize it.
**Fix:** Add --host-resolver-rules and update isLocalAddress().

## Progress
All 3 issues implemented, TS compiles clean. Ready for docker build + manual testing.

## Changes Made

### Issue 3 (Localhost DNS)
- `browser-manager.service.ts`: Added `host.docker.internal` to `isLocalAddress()`
- `browser-manager.service.ts`: Added `--host-resolver-rules=MAP host.docker.internal host-gateway` to `setupBrowser()` when `RUNNING_IN_DOCKER=true`

### Issue 2 (Screenshots)
- `browser-manager.service.ts`: Removed `--disable-images` from stealth args
- `page-crawler.service.ts`: Raised screenshot threshold from 10→30 pages, smaller thumbnails (640x360, q30)
- `element-detection.service.ts`: Flags elements with `<img>` children for screenshot capture. After extraction, captures up to 20 element screenshots (JPEG q50, 3s timeout). Non-image elements still use CSS preview.
- `element.interface.ts`: Added `screenshot?: string` field to `DetectedElement`
- `ElementPreviewCard.tsx`: Shows screenshot if available, falls back to CSS preview

### Issue 1 (Discovery progress)
- `DiscoveryContext.tsx`: Rewrote `startBackgroundDiscovery()` as fire-and-forget. Starts progress polling alongside the main API call. Progress polling updates state in real time.
- `DiscoveryModal.tsx`: Rewired to use `useDiscoveryContext` instead of local `useDiscovery` hook. Modal stays open during discovery with phase progress, progress bar, and live URL feed. Minimize button sends to floating indicator.
- `DiscoveryFloatingIndicator.tsx`: Only shows when `isMinimized === true` (was showing whenever `activeDiscovery` existed)
- `ProjectDetailsPage.tsx`: Added `useRef` for restore tracking. When floating indicator's maximize button is clicked, modal auto-reopens.

## What Happened
(Filled after verification)
