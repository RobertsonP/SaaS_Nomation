# Four-Fix Implementation Sprint
Date: 2026-04-25
Branch: fixes_live_picker

## Plan
- [+] Fix 1: URL case preservation (3 files)
- [+] Fix 4: Element page/type grouping correctness (4 files)
- [+] Fix 2: Page rename UI + sort tiebreaker (5 files)
- [+] Fix 3: Live picker DOM-render (3 files)
- [+] QA pass via nomation-qa
- [+] QA fixes (HttpException, listener cleanup, fuller HTML escape)
- [+] Memory entries written + MEMORY.md index updated

Reference: C:\Users\Administrator\.claude\plans\hello-my-fried-i-velvet-umbrella.md

## Commits (oldest first)
- `86be10d` Fix 1: Preserve URL case during discovery (RFC 3986)
- `b1f00d3` Fix 4: Correct element grouping by page and type
- `c1293c3` Fix 2: Inline page rename in URLs tab
- `bf8809a` Fix 3: Live picker renders captured DOM in iframe
- `7aeb79b` QA fixes: HttpException for 404, iframe listener cleanup, fuller HTML escape

## Progress
- All four fixes shipped as separate commits on `fixes_live_picker`.
- Backend + frontend TS compile clean after each commit.
- QA agent (`nomation-qa`) ran a read-only audit across all four diffs.
- Two ship-blocking issues from QA (HttpException missing on the new PATCH; iframe listener cleanup) and one defense-in-depth concern (HTML escape) addressed in `7aeb79b`.
- Three project memories + one feedback memory written; MEMORY.md index updated.

## QA Findings — Disposition
- CRITICAL (capturePageState on public route, unauthenticated): pre-existing pattern. Session token serves as the credential. Captured in `project_live_picker_dom_render.md` for future hardening sprint. **Not changed this sprint.**
- HIGH (iframe listener leak on Recapture): **Fixed** — listeners tracked in `iframeListenersRef` and detached before each new attach + on unmount.
- MEDIUM (raw Error → 500 on PATCH urls/:urlId): **Fixed** — throws `HttpException(NOT_FOUND)`.
- MEDIUM (draftTitle stale at mount): no user-visible bug because `startEdit()` resets the draft. **Not changed.**
- MEDIUM (link-discovery static-vs-static dedup): pre-existing scope. **Not changed.**
- LOW (escapeAttr only escaped `"`): **Fixed** — also escapes `&`, `<`, `>`.
- LOW (console.log in projects.service.ts `update`): pre-existing, not in this sprint's diff. **Not changed.**

## What Happened
Picked up the 2026-04-21 plan after a four-day pause. Verified the plan was still accurate against current code. User confirmed two trade-off concerns (irreversible URL data loss for old projects; hover/dynamic states not needed for testing) and chose recommendations on the two open decisions (sort tiebreaker B; drop sidebar A; one PR with all commits). User then added a fourth scope item — element grouping correctness by page and type — based on a fresh observation that elements weren't placed correctly. Three Explore agents audited the new scope and pinpointed:
- Backend `project-analysis.service.ts:226` doing case-sensitive `===` URL match → silent attribution to `sourceUrlId: null`.
- Frontend `ElementLibraryPanel.tsx` falling back to `'unknown'` (page) and `'element'` (type) for nulls, hiding attribution gaps and merging null types with the detector's legitimate `'element'` bucket.

All four fixes implemented in plan order (1, 4, 2, 3). QA caught two real ship-blockers and one defense-in-depth gap — all addressed in a follow-up commit. Branch is ready for PR to master.

## Next Steps
- User runs `docker compose up --build` and manually verifies in a browser.
- Open one PR with all five commits to master.
