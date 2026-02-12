# Page Crawler Refactor
Date: 2026-02-12

## Plan
- [+] Step 1: Create url-normalization.service.ts (167 lines)
- [+] Step 2: Create link-discovery.service.ts (218 lines)
- [+] Step 3: Create menu-interaction.service.ts (410 lines)
- [+] Step 4: Slim down page-crawler.service.ts (558 lines, from 1302)
- [+] Step 5: Update discovery.module.ts to register new services
- [+] Step 6: Verify TypeScript compiles (clean, no errors)

## What Happened
Refactored the 1,302-line page-crawler.service.ts into 4 focused modules:
- **UrlNormalizationService** (167 lines): normalizeUrl, isPageUrl, generateTitleFromUrl, isLoginRedirect
- **LinkDiscoveryService** (218 lines): extractLinks, extractNewlyRevealedLinks, getVisibleLinkUrls
- **MenuInteractionService** (410 lines): discoverMenuLinks (full menu hover/click discovery)
- **PageCrawlerService** (558 lines): orchestrator with crawlPage, crawlWithDepth, browser lifecycle, page detection

Circular dependency between LinkDiscovery <-> MenuInteraction resolved via manual setter + onModuleInit lifecycle hook.

isLoginRedirect now takes authLoginUrl as a parameter instead of using this.authLoginUrl.

All business logic preserved unchanged. TypeScript compiles clean.
