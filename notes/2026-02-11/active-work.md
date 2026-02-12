# Active Work — 2026-02-11

## Current Plan: Fix Product + Partner Mode

### Steps
- [+] Step 1: Update Partner Mode in CLAUDE.local.md
- [+] Step 1: Update MEMORY.md with Current Work section
- [+] Step 1: Create active-work.md
- [+] Step 2: Remove all E2E tests (except helpers)
- [+] Step 3: Fix Discovery Auth Bug (browser.newContext)
- [+] Step 4: Enable Playwright-Native Locators
- [+] Step 5: Write session note

## Summary of Changes
1. **Partner Mode** — Updated activation to read active-work.md + handoff.md on every startup. Added 4 new session continuity laws.
2. **E2E Tests** — Removed all 22 spec files. Kept helpers only. User will write test scenarios.
3. **Discovery Auth** — Fixed `unified-auth.service.ts` to use `browser.newContext()` + `context.newPage()` instead of `browser.newPage()`. Explicit context with viewport, SSL, and userAgent config. Also fixed `checkAuthRequired`.
4. **Native Locators** — Added `LocatorType` and `locatorArgs` to `GeneratedSelector` interface. New `addNativeLocators()` method generates getByRole, getByText, getByLabel, getByTestId, getByPlaceholder, getByTitle. New `resolveLocator()` in both execution-queue.processor.ts and live-browser.service.ts.

## Verification Needed (by user)
- [ ] Discovery with auth on tts.am
- [ ] Discovery without auth on saucedemo.com
- [ ] Native locators generate correctly on any scanned page
