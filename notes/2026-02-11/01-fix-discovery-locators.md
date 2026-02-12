# Fix Discovery Auth + Playwright Native Locators
Date: 2026-02-11

## What Happened
Fixed two critical bugs: Discovery crashed when using auth (browser.newPage() context reuse issue), and only CSS selectors were generated instead of Playwright-native locators. Also cleaned up E2E tests — user will write test scenarios going forward.

## What Was GOOD
- Read all relevant files before making any changes — understood full data flow
- Auth fix was surgical: only 2 locations needed changing
- Native locators integrate cleanly — existing CSS selectors still work, native locators are additive
- TypeScript compiled clean on first try after all changes

## What Was BAD
- Previous sprint marked "Done" with broken features — discovery auth was never actually tested with real auth flow

## NEVER DO THIS
- Never use `browser.newPage()` when the context needs to be reused — always use `browser.newContext()` + `context.newPage()` to create explicit, configurable contexts
- Never mark a feature "Done" without testing the actual user flow end-to-end
- Never auto-generate test suites — user writes test scenarios, Claude implements

## ALWAYS DO THIS
- Always use `browser.newContext()` with explicit config (viewport, ignoreHTTPSErrors, userAgent) before creating pages
- Always add `locatorType` and `locatorArgs` metadata when generating selectors — enables both CSS fallback and native resolution
- Always parse native locator strings with regex in execution engines — the pattern `getByRole('button', { name: 'Submit' })` must be supported everywhere selectors are resolved

## KEY INSIGHT
The selector generator runs in browser context (page.evaluate), so it can't call Playwright API methods directly. Instead, it stores the locator METHOD and ARGUMENTS as metadata, and the execution engine (which HAS Playwright access) resolves them at runtime. This two-phase approach (generate metadata → resolve at execution) is the correct architecture.

## Technical Reference
- Files changed:
  - `backend/src/auth/unified-auth.service.ts` — browser.newContext() fix (lines 38-63)
  - `backend/src/browser/strategies/selector-strategy.interface.ts` — LocatorType + locatorArgs
  - `backend/src/browser/advanced-selector-generator.service.ts` — addNativeLocators() + getImplicitRole()
  - `backend/src/queue/execution-queue.processor.ts` — resolveLocator() helper
  - `backend/src/browser/live-browser.service.ts` — resolveLocator() helper
- Decisions:
  - Native locators stored as human-readable strings (`getByRole('button', { name: 'Submit' })`) — parseable and debuggable
  - resolveLocator() uses regex parsing — simple, no external dependencies
  - Existing CSS selectors still work unchanged — fully backward-compatible
