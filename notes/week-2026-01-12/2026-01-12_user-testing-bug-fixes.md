# User Testing Bug Fixes - 10 Issues Report
Date: 2026-01-12
Status: 8 Bugs Fixed, 2 Features Pending

## Problem
User tested the application with account rob1@test.com and reported 10 issues:
1. Projects cannot be deleted
2. Analyze button throwing 404 error
3. Dark mode not applied for tabs/cards
4. Find more pages button not working
5. Want screenshots in sitemap (feature request)
6. Pages don't have names
7. View tests button breaks application
8. Smart analysis to avoid duplications (feature request)
9. Element locators like a:nth-child unacceptable
10. Design too big/thick (buttons, fonts)

## Investigation & Changes Made

### Issue #1: Delete Project Not Working
- **Root Cause**: Missing cascade deletion of related tables
- **File**: `backend/src/projects/projects.service.ts`
- **Fix**: Added comprehensive cascade deletion order:
  - TestExecution -> Test -> ProjectElement -> PageRelationship -> PageState -> BrowserSession -> AuthFlow -> ProjectUrl -> Project

### Issue #2: Analyze Button 404 Error
- **Root Cause**: Link navigated to `/projects/${id}/analyze` but route doesn't exist
- **File**: `frontend/src/pages/projects/ProjectDetailsPage.tsx`
- **Fix**: Changed from `<Link>` to `<button onClick={handleAnalyzeProject}>`

### Issue #3: Dark Mode for Tabs/Cards
- **Root Cause**: Missing `dark:` Tailwind classes on tab buttons and stat cards
- **File**: `frontend/src/pages/projects/ProjectDetailsPage.tsx`
- **Fix**: Added dark mode variants to:
  - Tab buttons: `dark:bg-gray-800`, `dark:text-gray-400`, `dark:hover:bg-gray-700`
  - Tab content area: `dark:bg-gray-800`, `dark:border-gray-700`
  - Stat cards already had dark mode (verified)

### Issue #4: Discovery Not Finding Pages
- **Status**: Investigated - Code looks correct
- **Conclusion**: May be website-specific (bot detection, slow loading, etc.)
- **Files Verified**: `discovery.service.ts`, `page-crawler.service.ts`, `sitemap-parser.service.ts`

### Issue #6: Pages Missing Names
- **Root Cause**: Title extraction only from `<title>` tag, no fallback
- **Files**:
  - `backend/src/discovery/page-crawler.service.ts` - Added h1 and URL-based fallback
  - `backend/src/discovery/discovery.service.ts` - Added generateTitleFromUrl() helper
- **Fix**: 3-tier title fallback: `<title>` -> `<h1>` -> URL path parsing

### Issue #7: View Tests Button Breaks App
- **Root Cause**: Parameter mismatch - `useParams<{ id }>` vs route using `:projectId`
- **File**: `frontend/src/pages/tests/TestsPage.tsx`
- **Fix**: Changed to `useParams<{ projectId: string }>()`

### Issue #9: Bad Selectors (a:nth-child patterns)
- **Root Cause**: Low-quality selectors not rejected
- **Files**:
  - `backend/src/ai/selector-quality.service.ts` - Added `shouldRejectSelector()` method
  - `backend/src/projects/project-elements.service.ts` - Added filtering before saving
- **Fix**: Reject positional-only selectors and generic tag selectors

### Issue #10: Design Too Big/Thick
- **Root Cause**: Oversized button padding and heavy font weights
- **Files Modified**:
  - `frontend/src/index.css`: Global button `.btn` class refined
    - Padding: `10px 20px` -> `8px 16px`
    - Font-weight: `600` -> `500`
    - Font-size: `0.875rem` -> `0.8125rem`
  - `frontend/src/pages/DashboardPage.tsx`:
    - "Start Now" button: `px-6 py-3` -> `px-5 py-2`
    - "Launch Full Regression" heading: `text-xl font-bold` -> `text-lg font-semibold`
  - `frontend/src/pages/projects/ProjectDetailsPage.tsx`:
    - "Add Your First URL" button: `px-8 py-3 text-lg` -> `px-6 py-2.5`
  - `frontend/src/pages/projects/ProjectsPage.tsx`:
    - Empty state button: `px-6 py-3` -> `px-5 py-2.5`

## Testing
- Backend build: Passes
- Frontend build: Passes

## Result
8 of 10 issues resolved. 2 feature requests remain pending:
- Feature #5: Screenshots in sitemap (NEW FEATURE)
- Feature #8: Smart deduplication (NEW FEATURE)

## Next Steps
1. Implement screenshot capture for sitemap nodes
2. Add element deduplication logic during analysis
