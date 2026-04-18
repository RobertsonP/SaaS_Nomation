---
name: nomation-codebase
description: Complete map of the Nomation codebase structure, modules, and connections. Load this skill whenever working on Nomation code, debugging issues, planning changes, or when you need to understand where code lives and how modules connect. Always load before making changes to any file.
---

# Nomation Codebase Map

## Architecture
- Backend: NestJS + TypeScript + Prisma + PostgreSQL (port 3002)
- Frontend: React + TypeScript + Vite + Tailwind (port 3001)
- Browser automation: Playwright (chromium)
- Job queue: Bull + Redis (port 6379)
- Database: PostgreSQL (port 5432)
- AI: Ollama local (being replaced with Claude API)

## Backend Modules (backend/src/)

auth/ — JWT login, register, password management, organization guard
organizations/ — multi-tenant teams, invitations, roles (owner/admin/member/viewer)
projects/ — project CRUD, URL management, element storage, analysis orchestration
  - project-analysis.service.ts (724 lines) — orchestrates page analysis
  - project-elements.service.ts (408 lines) — element CRUD and deduplication
  - projects.service.ts (374 lines) — project CRUD
  - github.service.ts (118 lines) — repo cloning via simple-git
  - live-execution.service.ts (303 lines) — live step execution in browser session

discovery/ — site crawling engine (6 services, 2646 lines total)
  - discovery.service.ts (756 lines) — main orchestrator
  - page-crawler.service.ts (594 lines) — Playwright page navigation
  - link-discovery.service.ts (253 lines) — extracts <a href> from pages
  - menu-interaction.service.ts (410 lines) — hovers/clicks menus to reveal hidden links
  - sitemap-parser.service.ts (230 lines) — fetches/parses sitemap.xml
  - url-normalization.service.ts (167 lines) — URL deduplication

ai/ — element detection and analysis (14 files, 5241 lines total)
  - element-detection.service.ts (1445 lines) — THE CORE: DOM extraction via page.evaluate()
  - element-analyzer.service.ts (758 lines) — orchestrator: opens page, runs detection
  - ai.service.ts (369 lines) — ARIA analysis + rule-based fallback + callAIAPI PLACEHOLDER
  - ollama.service.ts (184 lines) — local AI using qwen2.5:7b (rarely available)
  - selector-quality.service.ts (389 lines) — scores selectors 0-1
  - interactive-element-discovery.service.ts (483 lines) — clicks triggers for hidden elements (DISABLED)
  - browser-manager.service.ts (255 lines) — Playwright lifecycle management
  - authentication-analyzer.service.ts (400 lines) — analyzes pages behind auth

browser/ — live browser sessions (7 files, 3414 lines total)
  - live-browser.service.ts (870 lines) — manages Playwright sessions
  - CRITICAL: executeAction() only handles click/hover/type — 11 other actions MISSING

execution/ — test running (6 files, 1499 lines)
  - execution.service.ts (463 lines) — DIRECT execution (simpler, no video, no smart waits)
  - execution.controller.ts (451 lines) — API endpoints
  - smart-wait.service.ts (97 lines) — EXISTS but NOT connected to direct execution

queue/ — Bull job queue (3 files, 940 lines)
  - execution-queue.processor.ts (704 lines) — QUEUE execution (full: video, smart waits, all steps)

billing/ — Stripe (MOCK: uses sk_test_mock)
reporting/ — email service + report template
mcp/ — Model Context Protocol (100% PLACEHOLDER — all TODO)
test-suites/ — suite grouping and execution
tests/ — individual test CRUD

## Frontend Pages (frontend/src/pages/)
/login, /register — auth
/dashboard — project overview
/projects, /projects/:id — project management with tabs (URLs, elements, auth, sitemap)
/test-builder/:testId — main test creation (TestBuilderPanel 1179 lines)
/tests — test list
/test-results/:testId — BROKEN: imports missing RobotFrameworkResults component
/test-suites, /test-suites/:id — suite management
/suite-results/:id — BROKEN: imports missing RobotFrameworkSuiteResults component
/settings/profile, /settings/notifications — user settings

## Key Frontend Components
test-builder/ — 12 files, drag-drop test step creation
elements/ — element library display, CSS preview, table explorer
element-picker/ — BrowserPreview (iframe-based, broken for cross-origin), LiveElementPicker
execution/ — live execution viewer, video player, session browser
sitemap/ — discovery modal, site map graph visualization
