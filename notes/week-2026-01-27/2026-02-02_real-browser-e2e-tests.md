# Real Browser E2E Tests Implementation
Date: 2026-02-02

## What Happened
Created comprehensive real browser E2E tests using Playwright that test Nomation against REAL external websites (no mocks).

## What Was GOOD
- All 7 test files created following consistent patterns
- Helper utilities cover all common operations (login, project creation, discovery, analysis)
- Playwright config updated with 3 projects: default, real-sites, real-sites-headed
- 57 total tests covering 7 different real websites
- Tests are properly isolated with cleanup

## What Was BAD
- None identified - clean implementation

## Files Created

### Helper File
- `backend/test/e2e/real-sites/helpers/real-site.helper.ts` - Shared utilities

### Test Files (7 total)

| File | Site | Tests | Focus |
|------|------|-------|-------|
| `saucedemo.spec.ts` | Swag Labs | 9 | Login, cart, checkout |
| `expand-testing.spec.ts` | Expand Testing | 9 | Forms, inputs, alerts |
| `the-internet.spec.ts` | The Internet | 10 | Dynamic elements, iframes |
| `automation-exercise.spec.ts` | Automation Exercise | 8 | E-commerce flow |
| `bppulse.spec.ts` | BPPulse (yours) | 6 | Public site discovery |
| `litarchive.spec.ts` | LitArchive (yours) | 6 | Content discovery |
| `tts-am.spec.ts` | TTS (yours) | 9 | Auth flow + protected pages |

### Config Updated
- `backend/playwright.config.ts` - Added real-sites and real-sites-headed projects

## How to Run

```bash
# Run all real-site tests (headless)
cd backend && npx playwright test --project=real-sites

# Run with visible browser (debugging)
npx playwright test --project=real-sites-headed

# Run specific site
npx playwright test saucedemo.spec.ts --project=real-sites

# Run with debug mode
npx playwright test saucedemo.spec.ts --debug
```

## Test Credentials

| Site | Username | Password |
|------|----------|----------|
| Swag Labs | standard_user | secret_sauce |
| Swag Labs (locked) | locked_out_user | secret_sauce |
| The Internet | tomsmith | SuperSecretPassword! |
| TTS.am | robert | CpanelAsdasd123+ |

## ⛔ NEVER DO THIS
- Don't run real-site tests in parallel (network contention)
- Don't use short timeouts for external sites (use 120-180s)
- Don't skip cleanup (projects accumulate)

## ✅ ALWAYS DO THIS
- Use `--headed` flag when debugging real site tests
- Check network connectivity before running tests
- Use test.setTimeout() for long operations
- Cleanup test projects in afterAll hooks

## 💡 KEY INSIGHT
Real browser E2E tests are slow but prove features work in production. When they pass, you KNOW it works on real sites - no mock can provide that confidence.

## Technical Reference
- Helper: `backend/test/e2e/real-sites/helpers/real-site.helper.ts`
- Config: `backend/playwright.config.ts`
- All tests in: `backend/test/e2e/real-sites/`
