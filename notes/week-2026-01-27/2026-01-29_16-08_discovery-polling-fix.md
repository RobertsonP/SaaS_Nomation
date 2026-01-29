# Discovery Polling & Background Mode Fix
Date: 2026-01-29 16:08
Status: Working

## Problem
1. Discovery polling was too aggressive (every 1 second), causing 429 errors
2. Users couldn't minimize the discovery modal and continue working

## Changes Made

### File: `frontend/src/components/sitemap/DiscoveryModal.tsx`
- Line 84-88: Added new refs for polling state (`pollIntervalRef`, `errorCountRef`, `pollError` state)
- Lines 90-162: Completely rewrote polling logic:
  - Changed from 1s interval to 3s base interval
  - Added exponential backoff on errors (3s → 6s → 12s → max 30s)
  - Added stop condition when status is 'complete' or 'failed'
  - Added error counter - stops after 10 consecutive failures
  - Shows user-friendly warning after 3 consecutive failures
- Lines 272-283: Added minimize button next to close button (only visible during discovery)
- Added `onMinimize` prop to component interface

### File: `frontend/src/components/sitemap/useSiteMapData.ts`
- Lines 118-128: Changed `checkProgress` to re-throw errors instead of silently swallowing them

### New File: `frontend/src/contexts/DiscoveryContext.tsx`
- Created context to manage background discovery state
- Stores: projectId, projectName, rootUrl, status, phase, pagesFound, discoveredUrls
- Provides: `startBackgroundDiscovery`, `minimizeDiscovery`, `restoreDiscovery`, `clearDiscovery`
- Shows toast notifications when discovery completes or fails

### New File: `frontend/src/components/discovery/DiscoveryFloatingIndicator.tsx`
- Floating indicator component shown when discovery is minimized
- Shows status (running/complete/failed), pages found count
- Buttons to restore or dismiss

### File: `frontend/src/App.tsx`
- Added `DiscoveryProvider` to wrap the app
- Added `DiscoveryFloatingIndicator` component

### File: `frontend/src/pages/projects/ProjectDetailsPage.tsx`
- Added `useDiscoveryContext` hook
- Added `onMinimize` prop to DiscoveryModal

## Testing
- Command: `docker compose restart frontend && docker compose logs frontend --tail 20`
- Result: Frontend starts without errors
- Command: `npx tsc --noEmit | grep Discovery`
- Result: No TypeScript errors in modified files

## Phase 2: Dark Mode Sweep (Added)

### File: `frontend/src/components/test-builder/TestConfigurationModal.tsx`
- Added dark: variants to all backgrounds, borders, text colors
- Fixed modal container, header, form inputs, labels, footer

### File: `frontend/src/components/test-builder/TemplateModal.tsx`
- Added dark: variants to modal, header, input, template cards

### File: `frontend/src/components/test-builder/SelectorValidator.tsx`
- Fixed validation result boxes (green/red)
- Fixed quality bar background
- Fixed suggestion text colors
- Fixed quality explanation colors

### File: `frontend/src/components/test-builder/SortableTestStep.tsx`
- Fixed `getStepTypeColor()` - added dark variants for all 14 step types
- Fixed main container, drag handle, step number, step content
- Fixed action buttons hover states

### File: `frontend/src/components/test-builder/ElementLibraryPanel.tsx`
- Fixed `getQualityColor()` - added dark variants for high/medium/low quality

## Phase 3: UX Fixes (Added)

### File: `frontend/src/pages/projects/ProjectsPage.tsx`
- Changed Edit button → "Open" button that navigates to project details
- Added dark mode to Open button and Delete button
- Added dark mode to "View" link button

### File: `frontend/src/components/analysis/AnalysisProgressModal.tsx`
- Added `p-4` padding to overlay to prevent edge touching
- Changed modal height from `max-h-[80vh]` to `max-h-[85vh]`
- Added `flex flex-col` structure for proper scrolling
- Fixed header, progress bar, and footer with `flex-shrink-0`
- Made progress log area `flex-1` with proper scroll
- Added dark mode to progress log status items (error, completed, started)
- Added dark mode to error details box

## Next Steps
- Test in browser with actual discovery
- Verify 429 errors no longer appear in console
- Test minimize button works and floating indicator appears
- Test dark mode in test builder pages
- Test analysis popup visibility improvements
