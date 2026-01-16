# Smart URL Discovery - Backend Complete
Date: 2026-01-11 15:30
Status: ✅ Backend Working (Frontend UI Pending)

## Problem
Users had to add each URL manually. No automatic page discovery from a single URL.

## Implementation Details

### Database Schema Changes
Added to `prisma/schema.prisma`:

1. **ProjectUrl model** - New fields:
   - `discovered` (Boolean) - Was URL auto-discovered?
   - `discoveryDepth` (Int) - Depth from root URL
   - `requiresAuth` (Boolean) - Does page require auth?
   - `pageType` (String) - navigation, content, form, etc.
   - `outgoingLinks` / `incomingLinks` - Relations to PageRelationship

2. **PageRelationship model** (NEW):
   - Tracks links between pages
   - Fields: sourceUrlId, targetUrlId, linkText, linkType
   - Enables sitemap graph visualization

### New Backend Module: `/backend/src/discovery/`
```
discovery/
├── discovery.module.ts        # NestJS module
├── discovery.service.ts       # Main orchestrator
├── discovery.controller.ts    # API endpoints
├── sitemap-parser.service.ts  # Parse sitemap.xml
└── page-crawler.service.ts    # Crawl pages for links
```

### API Endpoints Created
- `POST /api/projects/:id/discover` - Start discovery from root URL
- `GET /api/projects/:id/discover/progress` - Get discovery progress
- `GET /api/projects/:id/sitemap` - Get page structure (nodes + edges)
- `POST /api/projects/:id/select-pages` - Select pages for analysis

### Discovery Flow
```
User enters: https://example.com
↓
1. Try sitemap.xml (common locations)
2. Try robots.txt for sitemap reference
3. Crawl pages to discover links
4. Build page relationship graph
5. Store in database
6. Return discovered pages for selection
```

### Features
- Sitemap.xml parsing (including sitemap index files)
- Robots.txt sitemap extraction
- Playwright-based page crawling
- Link extraction (nav, footer, sidebar, content, buttons)
- Auth requirement detection
- Page type classification
- Depth-limited crawling (default: 3 levels, 100 pages max)
- URL normalization and deduplication

### Frontend API Functions Added
```typescript
projectsAPI.startDiscovery(projectId, rootUrl, options)
projectsAPI.getDiscoveryProgress(projectId)
projectsAPI.getSiteMap(projectId)
projectsAPI.selectPagesForAnalysis(projectId, urlIds)
```

## Testing
- Backend build: SUCCESS
- Frontend build: SUCCESS
- Prisma generate: SUCCESS
- Database migration: Pending (requires DATABASE_URL)

## Dependencies Added
- `axios` - HTTP requests for sitemap fetching
- `xml2js` - XML parsing for sitemaps

## Result
Backend discovery infrastructure complete. Frontend UI for discovery and sitemap visualization is next (Item #3).

## Next Steps
- Item #3: Build Site Map Visualization (react-flow)
- Will use `getSiteMap()` API to render interactive graph
- Discovery modal in project creation flow
