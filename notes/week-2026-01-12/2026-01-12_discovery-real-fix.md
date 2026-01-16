# Discovery Feature - REAL Fix (Not Website-Specific!)
Date: 2026-01-12
Status: Completed

## Problem
User reported "Find More Pages" discovery returns 0 results. Previous response blamed "website-specific" issues - this was WRONG.

## Investigation
Found 6 real bugs in the code:

| Bug | Root Cause |
|-----|------------|
| 1 | Bot user-agent "Nomation-Bot" blocked by websites |
| 2 | No sitemap = silent failure, no feedback |
| 3 | 30s timeout too short for slow sites |
| 4 | Page errors swallowed, user sees 0 results |
| 5 | Frontend extracts wrong error message from axios |
| 6 | Buttons confusing (duplicate Analyze buttons) |

## Changes Made

### Backend - page-crawler.service.ts
- Line 59: Changed user-agent from "Nomation-Bot/1.0" to real Chrome UA
- Line 70: Increased timeout from 30000ms to 60000ms
- crawlWithDepth(): Added failure tracking, throws error if ALL pages fail

### Backend - sitemap-parser.service.ts
- Line 63-69: Changed user-agent to Chrome
- Line 122-128: Changed robots.txt fetcher user-agent to Chrome
- Increased timeouts from 10s/5s to 15s/10s

### Backend - discovery.service.ts
- Added "No sitemap found, will discover pages by crawling links..." message
- Better progress messages during crawl

### Frontend - useSiteMapData.ts
- Line 100: Fixed error extraction to get actual API error message
- `(err as any)?.response?.data?.message || err.message`

### Frontend - ProjectDetailsPage.tsx
- Orange button: Renamed to "Smart Discover" with icon
- Blue button: Changed to "Discover Pages"
- Both now open Discovery modal for better UX flow

## Testing
- Backend build: Pass
- Frontend build: Pass

## Result
Discovery should now:
- Work on websites that block bot user-agents
- Handle slow-loading sites (60s timeout)
- Show clear error messages when failures occur
- Give user feedback when no sitemap found
- Have clear button labeling

## Next Steps
Test on tts.am and other real websites to verify fix works.
