---
name: nomation-testing
description: How to test and verify changes in Nomation. Use when running the application, verifying fixes, checking regressions, or when the user asks to test something. Includes startup commands and verification checklists for each feature area.
---

# Testing and Verification Guide

## Starting the Application

### Hybrid Mode (preferred after migration):
docker compose -f docker-compose.dev.yml up -d   # start databases only
cd backend && npm run dev                          # backend on :3002
cd frontend && npm run dev                         # frontend on :3001

### Full Docker Mode (current):
docker compose up --build

### Useful Commands:
cd backend && npx tsc --noEmit          # TypeScript check backend
cd frontend && npx tsc --noEmit         # TypeScript check frontend
cd backend && npm test                   # run backend unit tests
cd backend && npx prisma studio          # database browser on :5555

## Verification by Feature Area

### Auth: Register → Login → Protected pages
1. POST /api/auth/register with name, email, password → creates user + org
2. POST /api/auth/login with email, password → returns JWT token
3. GET /api/auth/profile with Bearer token → returns user data
4. Access any /api/ endpoint without token → should return 401

### Projects: Create → Add URLs → View
1. Create project via dashboard → appears in project list
2. Add URL to project → appears in URLs tab
3. Delete project → cascades (elements, tests, suites all removed)

### Discovery: Start → Progress → Results
1. Enter URL and start discovery → WebSocket shows live progress
2. Should find pages via link crawling (sitemap skipped for localhost)
3. Results show in sitemap tab with page thumbnails

### Element Analysis: Analyze → Elements in Library
1. Click "Analyze" on project URLs → runs Playwright analysis
2. Elements appear in element library grouped by page URL
3. Each element shows type badge, description, CSS preview
4. Filter by type (buttons, inputs, links, tables) works

### Test Builder: Create Steps → Save → Execute
1. Drag element from library → creates test step with default action
2. Change step type from dropdown → updates action
3. Edit step value (for type, assert, select actions)
4. Save test → persists to database
5. Reopen test → loads saved steps from database (or localStorage if unsaved)

### Test Execution: Run → Watch Progress → View Results
1. Run test → browser opens, executes steps, WebSocket shows progress
2. Each step shows pass/fail status
3. Failed step shows error message and screenshot
4. NOTE: Test results page currently BROKEN (BUG-001)
