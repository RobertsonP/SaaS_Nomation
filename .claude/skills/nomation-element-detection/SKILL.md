---
name: nomation-element-detection
description: How Nomation's element detection works — the DOM extraction pipeline, selector generation, quality scoring, and known gaps. Load this skill when working on element-detection.service.ts, selector-quality.service.ts, element-analyzer.service.ts, or any element-related feature. Essential for understanding why elements are found or missed.
---

# Element Detection Deep Dive

## The Pipeline
1. Playwright opens the target page and waits for load
2. page.evaluate() runs JavaScript INSIDE the browser context
3. Single optimized CSS query finds all interactive elements: button, input, textarea, select, a, [role=*], [data-testid], [onclick], [tabindex], [aria-label], h1-h3, label, img[alt], video, iframe
4. Table detection runs separately — extracts headers, rows, cells, selectors
5. Each element goes through filtering (visibility, interactivity, deduplication)
6. Surviving elements get: selector generation, CSS property extraction, bounding rect
7. Results returned to Node.js and saved via Prisma

## Selector Generation Priority (in element-detection.service.ts)
1. #id (highest confidence — 0.85+)
2. [data-testid="..."] (0.9 confidence)
3. [name="..."] for form elements (0.75)
4. [aria-label="..."] (0.8)
5. tag[type="..."] (0.7)
6. tag.class-name (0.5-0.7)
7. Multi-attribute combinations (0.6-0.7)
8. Text-based: tag:has-text("...") (0.7 — Playwright-specific)
9. Parent-child: .parent > tag (0.6)
10. nth-child (LAST RESORT — rejected by quality filter if on generic elements)

## Quality Scoring (selector-quality.service.ts)
Overall = uniqueness(0.4) + stability(0.3) + specificity(0.2) + accessibility(0.1)
Minimum threshold: 0.5 — selectors below this are rejected
Rejected patterns: div:nth-child, position-only selectors, generic tag-only, single class on div/span

## Known Gaps (WHY elements get missed)
1. Early exit at line 349-361 filters out elements BEFORE checking computedStyle.cursor
   - Divs with cursor:pointer via CSS class (not inline style) get skipped
2. React/Vue onClick handlers not in HTML onclick attribute — __reactFiber$ not checked
3. Elements below the fold (lazy-loaded on scroll) — detection runs once on load
4. Shadow DOM elements — querySelectorAll can't reach inside shadow roots
5. JavaScript event delegation targets — parent has handler, child is the visual target

## Interactive Discovery (DISABLED in master)
interactive-element-discovery.service.ts can click triggers (buttons with aria-haspopup, aria-expanded) to reveal modals and dropdowns, then extract the new elements. Currently commented out in element-analyzer.service.ts line 44-46 for performance. Should be re-enabled as opt-in "Deep Scan".
