# Discovery Fix + Partner Mode Laws + Plugin Setup
Date: 2026-02-08

## What Happened
Fixed the discovery feature so discovered pages properly appear in projects. Added session continuity laws and configured missing MCP plugins. Verified with real Playwright browser test on saucedemo.com.

## What Was GOOD
- Backend already saved discovered URLs to DB during discovery — no API call needed from frontend
- Real browser verification caught the onboarding modal blocking clicks (good to know for future tests)
- Parallel execution of independent tasks saved time

## What Was BAD
- Initial analysis assumed frontend needed to make API calls to add URLs — wasted time reading unnecessary code
- The "fake node IDs" bug was more cosmetic than functional since backend already saved URLs

## NEVER DO THIS
- Assume the backend doesn't save data: Check the backend service FIRST before adding frontend API calls
- Pass internal UI IDs as API parameters: Always map to actual data (URLs, DB IDs) before callbacks
- Silently ignore missing auth flows: Throw clear errors so the user knows what's wrong

## ALWAYS DO THIS
- Read the full data flow (frontend -> API -> service -> DB) before fixing: Prevents fixing the wrong layer
- Add success/error notifications for every user action: Users need feedback
- Verify fixes with real browser tests, not just code review

## KEY INSIGHT
The discovery "bug" was mostly a feedback problem — the backend worked correctly, but the frontend never told the user what happened. Always add user-visible feedback for every action.

## Technical Reference
- Files: DiscoveryModal.tsx, ProjectDetailsPage.tsx, discovery.service.ts
- Decisions: Backend already saves to DB, so frontend just needs refresh + notification
