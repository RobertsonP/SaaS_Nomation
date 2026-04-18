---
name: nomation-discovery
description: How Nomation's site discovery and crawling system works. Load when working on discovery.service.ts, page-crawler.service.ts, link-discovery.service.ts, menu-interaction.service.ts, or sitemap-parser.service.ts. Essential for understanding why pages are found or missed during discovery.
---

# Discovery System

## The Pipeline
1. User provides root URL → discovery.service.ts orchestrates
2. Pre-flight check: HTTP HEAD request to verify URL is reachable
3. If auth flow provided: load credentials, prepare authenticated browsing
4. Sitemap check: try /sitemap.xml, /sitemap_index.xml, robots.txt (SKIPPED for localhost)
5. Crawling: page-crawler opens root URL with Playwright
6. For each page: extract title, detect page type, take screenshot, extract links
7. Link extraction: link-discovery.service.ts gets all <a href> + menu-interaction discovers hidden links
8. Menu interaction: hovers/clicks nav items to reveal dropdown menus (max 15 items, 15s timeout)
9. Crawl continues BFS up to maxDepth (default 3) and maxPages (default 100)
10. Results saved to ProjectUrl table with relationships in PageRelationship table

## Known Issues
- Ghost pages on content-heavy sites: crawler follows ALL links including content items (books, articles, profiles), creating 50+ pages from a single listing page. Link location info (navigation vs content) exists but isn't used to prioritize.
- SPA routes not discovered: only follows <a href> links. JavaScript-only navigation (React Router pushState) invisible to crawler.
- Docker URL translation: isLocalAddress() and translateLocalhostForDocker() duplicated in 4+ files. Should be centralized.
- For localhost: sitemap check correctly skipped, falls back to crawling.

## SPA Detection
page-crawler detects frameworks: __NEXT_DATA__, #__next (Next.js), __NUXT__ (Nuxt), __VUE__ (Vue), [data-reactroot] (React), [ng-version] (Angular), [class*="svelte-"] (Svelte). Adjusts wait times accordingly.

## Auth-Aware Crawling
page-crawler can use auth storage state (cookies + localStorage) from UnifiedAuthService. Detects login redirects via url-normalization.service.ts isLoginRedirect(). Re-applies cookies if session lost during crawl.
