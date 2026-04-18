---
name: nomation-playwright
description: Playwright usage patterns, configuration, and gotchas specific to Nomation. Load when working on any browser automation code — element detection, page crawling, test execution, live browser sessions, or browser manager. Prevents common Playwright mistakes.
---

# Playwright in Nomation

## Where Playwright is Used (6 places)
1. page-crawler.service.ts — discovery crawling (playwright.chromium.launch)
2. live-browser.service.ts — live element picking sessions (chromium from playwright)
3. element-analyzer.service.ts — page analysis via browser-manager.service.ts
4. execution.service.ts — direct test execution (chromium from playwright)
5. execution-queue.processor.ts — queue test execution (chromium from playwright)
6. live-execution.service.ts — live step execution (dynamic import('playwright'))

## Common Launch Args (use everywhere consistently)
--no-sandbox, --disable-setuid-sandbox, --disable-dev-shm-usage, --disable-gpu
Docker-only: --host-resolver-rules=MAP host.docker.internal host-gateway
Docker-only: --disable-blink-features=AutomationControlled

## GOTCHAS — Things that have broken before
- Use page.setViewportSize() NOT page.setViewport() — Playwright API difference from Puppeteer
- Use 'networkidle' NOT 'networkidle2' — networkidle2 is Puppeteer syntax
- Always use locator.click() not page.click() — page.click is deprecated
- Always close browser in finally block — leaked browsers consume memory
- Set timeout on every Playwright operation — default timeout is 30s which is too long
- For localhost with HTTPS: use ignoreHTTPSErrors: true in browser context
- Screenshots: type 'jpeg' with quality 70 for reasonable file size

## Wait Strategies
- SmartWaitService exists in execution/smart-wait.service.ts
- Provides: waitForNetworkIdle, waitForElementStable, waitForDomSettled
- Currently ONLY used in execution-queue.processor.ts
- Should be used in execution.service.ts and live-browser.service.ts too
- For SPAs: wait for framework hydration (check #root children, #__next, [data-reactroot])

## Browser Session Management
- live-browser.service.ts keeps sessions in Map<string, {browser, page}>
- Sessions expire after 2 hours (cleanup runs every 30 minutes)
- Always update lastActivity on interaction to prevent premature cleanup
