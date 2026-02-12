# Plan: Convert All Tests to Real Playwright Browser Tests
Date: 2026-02-08

## Principle
Every test runs a real Playwright browser against real services. No mocks, no fakes, no jest.fn().

## Phase 1: Delete All Mock Tests
Delete 18 backend mock files + 2 frontend mock files + mock infrastructure

## Phase 2: Write Replacement Playwright Tests
Coverage that was in deleted mocks, now tested through real browser:

| Old Mock File | New Playwright Coverage | Test Through |
|---------------|------------------------|--------------|
| unit/url-filtering.spec.ts | URL normalization during real discovery | e2e/discovery.spec.ts |
| unit/docker-url.utils.spec.ts | Docker URL handling | e2e/discovery.spec.ts |
| unit/selector-quality.spec.ts | Selector quality during real analysis | NEW: e2e/element-analysis.spec.ts |
| unit/popup-detection.spec.ts | Popup detection on real pages | NEW: e2e/element-analysis.spec.ts |
| unit/dropdown-detection.spec.ts | Dropdown detection on real pages | NEW: e2e/element-analysis.spec.ts |
| unit/state-change-detection.spec.ts | State change on real pages | NEW: e2e/element-analysis.spec.ts |
| unit/element-picker-accuracy.spec.ts | Element picker on real pages | NEW: e2e/element-picker.spec.ts |
| api/health.test.ts | Health check via browser | NEW: e2e/api-health.spec.ts |
| api/auth.test.ts | Already covered by e2e/auth.spec.ts | EXISTING |
| api/projects.test.ts | Already covered by e2e/project-crud.spec.ts | EXISTING |
| api/element-analyzer.test.ts | Element analysis E2E | NEW: e2e/element-analysis.spec.ts |
| api/auth-flows.test.ts | Auth flow CRUD E2E | EXISTING: e2e/auth-flow-setup.spec.ts |
| integration/* | Full integration via E2E | Covered by existing + new E2E |

## Phase 3: Frontend Playwright Tests
All frontend pages tested through real browser:
- Login/Register flow
- Projects list
- Project details (URLs, discovery, analysis)
- Test suites management
- Settings/Profile

## Test Infrastructure
- Playwright config: backend/playwright.config.ts
- Real users: test@test.com / test
- Real services: localhost:3001 (frontend), localhost:3002 (backend API)
- Real external sites: saucedemo.com, the-internet.herokuapp.com, practice.expandtesting.com
