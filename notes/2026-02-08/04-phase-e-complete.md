# Phase E Complete: Feature Bug Fixes (TASK-11 to TASK-15)
Date: 2026-02-08

## What Happened
Fixed 5 feature bugs: discovery speed, URL filtering, dropdown/popup/state-change detection in the element analyzer. All tests pass (227 total across affected suites).

## What Was GOOD
- Polling-based menu waits (100ms intervals) are much smarter than fixed delays
- Batch DB operations replaced 100+ sequential queries with 2-3 calls
- Scoping dropdown `<li>` extraction to container elements eliminates false positives

## What Was BAD
- Investigation report claimed www regex was broken — it wasn't. Always verify claims before acting.

## NEVER DO THIS
- Trust investigation report claims blindly: Test them with real code (e.g., `node -e` to verify regex behavior)
- Remove content-affecting URL params (`ref`, `source`, `campaign`): They can change what page content is shown

## ALWAYS DO THIS
- Use early-exit polling (100ms intervals) instead of fixed sequential waits for dynamic content
- Batch DB operations: findMany + createMany + Promise.all instead of sequential loops
- Scope DOM queries to container elements: `container.querySelectorAll('li')` not `element.querySelectorAll('li')`

## KEY INSIGHT
The biggest speed win wasn't a code optimization — it was making screenshots optional after the first 10 pages. Always question whether every operation is actually needed for every iteration.

## Technical Reference
- Files: page-crawler.service.ts, discovery.service.ts, sitemap-parser.service.ts, element-analyzer.service.ts
- Speed changes: 15s timeout (was 60s), conditional waits, optional screenshots, polling menus, batch DB
- URL filtering: unified extension lists, protocol validation, removed aggressive param removal
- Analyzer: scoped dropdown options, validated controlled elements, Bootstrap collapse triggers
