# Fix: AI Test Generation Not Working
Date: 2026-04-20

## Plan
- [+] Investigate why "AI Generate Tests" produces no tests on `new_setup` branch
- [+] Identify root cause: env var loading
- [+] Install `dotenv` in backend
- [+] Add `import 'dotenv/config'` as first import in `backend/src/main.ts`
- [+] Document `ANTHROPIC_API_KEY` in `backend/.env.example`
- [+] Aggregate per-category errors in `claude-ai.service.ts` (throw when all 5 fail with zero tests)
- [+] Robust JSON parser: strip ```json fences, try direct parse, fallback regex, log raw on failure
- [+] TypeScript compiles clean (`npx tsc --noEmit` → `TSC_PASSED`)
- [ ] User verifies in browser (red toast → green toast with N > 0 tests)

## Progress

### Root cause
Architecture is hybrid (`scripts/start.js`): Docker only runs postgres+redis, backend runs natively via `npm run dev` → `nest start --watch`. The launcher `_run_backend.bat` `set`s a hardcoded env var list (`scripts/start.js:225-235`) that does **not** include `ANTHROPIC_API_KEY`. NestJS does not auto-load `.env` (no `ConfigModule`, no `dotenv` import previously). So `process.env.ANTHROPIC_API_KEY` was always `undefined` inside the backend process, even though `backend/.env` correctly contained the key. `ClaudeAiService` constructor logged the warning, set `client = null`, and threw `"Claude AI not configured"` on every request.

### Files changed
| File | Change |
|------|--------|
| `backend/package.json` | Added `dotenv ^17.4.2` |
| `backend/src/main.ts` line 1 | `import 'dotenv/config';` (must be first import) |
| `backend/.env.example` | Documented `ANTHROPIC_API_KEY` at bottom |
| `backend/src/ai/claude-ai.service.ts` | (a) `generateTestSuite` aggregates errors and throws if all categories fail with zero tests; (b) extracted `parseTestsJson` — strips markdown fences, tries direct `JSON.parse`, falls back to bracket regex, logs first 500 chars of raw response on failure |

No frontend changes — `TestsPage.tsx:185-209` and `ProjectDetailsPage.tsx:415-437` already render backend error messages via `showError(...)`.

No DB migrations. Docker compose files untouched (Docker not in path for backend).

### Verification done
- `npx tsc --noEmit` → `TSC_PASSED`
- `git check-ignore -v backend/.env` → confirmed gitignored (`.gitignore:15:.env`)
- `backend/.env` not in `git status` (no risk of committing the key)
- Backend health endpoint still returns 200 on :3002 (watcher rebuilt cleanly)

### Verification remaining (user)
- Glance at backend launcher window for log line `"Claude AI service initialized"` (not the `not set` warning). If absent, manual restart of the backend may be needed since changes to `main.ts` sometimes don't hot-reload cleanly.
- Trigger "AI Generate Tests" on a project with analyzed elements → expect green toast with N > 0 tests within 30-90s.
- If something still fails, the new aggregate error path will surface the actual Claude error in the red toast instead of silently producing zero tests.

## What Happened
The AI test generation feature was wired correctly end-to-end (controller, services, module, frontend); the only thing broken was that `backend/.env` was never loaded into `process.env` because no part of the codebase called `dotenv` and the native launcher doesn't include the key in its hardcoded `set` list. One-line fix (`import 'dotenv/config'`) makes `.env` work for any startup method going forward. While in the file, hardened the silent-failure paths so future Claude API issues (rate limits, malformed JSON) surface as red error toasts instead of misleading green "0 tests generated" success messages.
