# Phase E Plan: Feature Bug Fixes (TASK-11 to TASK-15)
Date: 2026-02-08

## Execution Order
1. TASK-11: Fix discovery speed (biggest user impact)
2. TASK-12: Fix URL filtering
3. TASK-14: Fix dropdown detection
4. TASK-13: Fix popup/modal detection
5. TASK-15: Fix state change detection

## TASK-11: Discovery Speed Fixes
### Quick Wins
- Reduce page load timeout: 60s → 15s (line 166 of page-crawler)
- Conditional page-ready waits: check if page already loaded before waiting 2-3s
- Screenshots optional: only capture for first 10 pages

### Secondary Optimizations
- Adaptive menu wait: break early when links appear (100ms polling)
- Batch DB saves: use createMany + parallel updates in discovery.service.ts
- Already good: title detection is consolidated in single evaluate

### Files
- `backend/src/discovery/page-crawler.service.ts`
- `backend/src/discovery/discovery.service.ts`
