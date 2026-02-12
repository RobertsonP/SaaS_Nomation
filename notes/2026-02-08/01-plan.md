# Sprint Plan: Partner Mode Laws + Plugin Setup + Fix Discovery + Real Tests
Date: 2026-02-08

## What We're Building
Fixing the discovery feature so discovered pages actually get added to projects, setting up session continuity laws, and configuring missing plugins.

## Tasks
1. Update CLAUDE.local.md with session continuity laws + MCP verification protocol + test projects reference
2. Configure Brave Search + Memory MCP in mcp.config.json
3. Fix discovery bugs (BUG-1, BUG-4, BUG-5, BUG-7)
4. Verify fixes with real browser tests
5. Session handoff note

## Discovery Bug Analysis
- Backend already saves discovered URLs to DB during `startDiscovery()`
- `onDiscoveryComplete` in ProjectDetailsPage only calls `refetchSiteMap()` + `loadProject()` — this should work because backend saves to DB
- Real issue: DiscoveryModal passes fake node IDs ("discovered-0") — should pass actual URLs
- Auth flow silently falls back when not found (warns in log, no user notification)
- No success/error toast messages for discovery completion in ProjectDetailsPage handler

## Files to Modify
- `frontend/src/components/sitemap/DiscoveryModal.tsx` — pass URLs not fake IDs
- `frontend/src/pages/projects/ProjectDetailsPage.tsx` — add success notification on discovery complete
- `backend/src/discovery/discovery.service.ts` — throw error when auth flow not found

## Execution Order
1. CLAUDE.local.md (done)
2. mcp.config.json (done)
3. This plan note (done)
4. Fix discovery bugs
5. Verify
6. Session handoff
