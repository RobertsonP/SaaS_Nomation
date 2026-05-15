# Redesign Prep: Branch Hygiene + Master Sync
Date: 2026-05-07

## Plan
- [+] Clean working tree (gitignore + remove tracked PNGs)
- [+] Refresh CLAUDE.md (remove fixed bugs, list real backend debt)
- [+] Fast-forward merge `fixes_live_picker` → `master`
- [+] Untrack stale `.playwright-mcp/` snapshots that pre-dated gitignore
- [+] Push `master` to origin
- [+] Delete local `fixes_live_picker` branch
- [+] Create `redesign/v2` branch from master
- [+] Push `redesign/v2` to origin

## Progress

### Cleanup commits on top of Bundle 6
1. `c4c4a71` — chore: gitignore Playwright MCP snapshots and ad-hoc screenshots
   - Added `.playwright-mcp/` and `/*.png` to `.gitignore`
   - `git rm` on the 12 root-level screenshot PNGs that were already deleted from disk

2. `ff2e81d` — docs: refresh CLAUDE.md state
   - Old "BROKEN" section was 4-for-4 wrong (BUG-001/002/003/004 all fixed during recent sprints)
   - Replaced with: BACKEND DEBT (4 real items), MISSING FEATURES (3), VERIFIED FIXED (8 with file:line citations)

3. `db747e2` — chore: untrack `.playwright-mcp/` snapshots that slipped in before gitignore
   - 23 verification YAMLs from late-April sprints were already tracked
   - Removed from index (files stayed on disk) so they don't travel forever in master history

### Branch operations
- Fast-forward merge `fixes_live_picker` (1e27396 → ff2e81d) onto master — linear history, no merge commit
- Pushed master to `origin/master` (now at db747e2)
- Deleted local `fixes_live_picker`
- Created `redesign/v2` from master, pushed to origin

### TS verification
- `cd backend && npx tsc --noEmit` → exit 0
- `cd frontend && npx tsc --noEmit` → exit 0

## What Happened

`master` was 30 commits behind `fixes_live_picker` and the branch had never been pushed to origin. If we had branched from master directly to start the redesign, we would have lost the entire 6-bundle hotfix sprint plus the prior sprint's work (Live Picker locator emit, headed flicker fix, suite report styling, sidebar collapse, table explorer modal, run-mode picker, etc.).

Caught it before branching. Cleaned the working tree, refreshed CLAUDE.md so the new sprint doesn't waste time re-fixing already-fixed bugs, fast-forwarded master, pushed, and created `redesign/v2`. Both branches now on origin at db747e2.

Next session: when the Claude.ai design output is ready, start with `frontend/tailwind.config.js` token redesign, then `Layout.tsx` shell, then auth pages (low-blast-radius warmup), per the sequencing in `~/.claude/plans/hello-my-fried-i-velvet-umbrella.md` Step 8.

## Remaining work (carried over, not for redesign sprint)
- MCP module — 6 TODO stubs in `backend/src/mcp/`
- AI `callAIAPI` placeholder (`backend/src/ai/ai.service.ts:342-349`)
- Crawler link prioritization (BUG-007 partial)
- Duplicate-button selector context (BUG-006 partial)
- Mock Stripe billing, password reset flow, file storage beyond local disk
